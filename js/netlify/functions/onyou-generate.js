// netlify/functions/onyou-generate.js
// OnYou Form Builder — AI Template Generator (JSON-only + auto-repair)
//
// Requires env var:
// - OPENAI_API_KEY
//
// Optional env vars:
// - ONYOU_MODEL (default: "gpt-4.1-mini" if available)
// - ONYOU_MAX_OUTPUT_TOKENS (default: 2200)
// - ONYOU_MAX_PROMPT_CHARS (default: 1200)

const DEFAULT_MODEL = process.env.ONYOU_MODEL || "gpt-4.1-mini";
const MAX_OUTPUT_TOKENS = clampInt(process.env.ONYOU_MAX_OUTPUT_TOKENS, 2200, 500, 6000);
const MAX_PROMPT_CHARS = clampInt(process.env.ONYOU_MAX_PROMPT_CHARS, 1200, 200, 5000);

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return json(500, { error: "Server not configured: OPENAI_API_KEY missing" });

    const body = safeJson(event.body);
    const prompt = String(body?.prompt || "").trim();
    const kindHint = String(body?.kind || "").trim(); // optional: "form" | "document" | "resume"
    const categoryHint = String(body?.category || "").trim();

    if (!prompt) return json(400, { error: "Missing prompt" });
    if (prompt.length > MAX_PROMPT_CHARS) {
      return json(400, { error: `Prompt too long. Max ${MAX_PROMPT_CHARS} chars.` });
    }

    // 1) Generate draft template JSON
    const draft = await callOpenAI(apiKey, {
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt({ prompt, kindHint, categoryHint }) }
      ],
      max_output_tokens: MAX_OUTPUT_TOKENS
    });

    // Extract JSON
    let tpl = extractJsonObject(draft?.output_text || "");

    // 2) Validate + normalize minimal requirements server-side
    const val1 = validateTemplateShape(tpl);
    if (!val1.ok) {
      // 3) Auto-repair pass (still JSON-only)
      const repair = await callOpenAI(apiKey, {
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: REPAIR_SYSTEM_PROMPT },
          { role: "user", content: buildRepairPrompt({ originalText: draft?.output_text || "", errors: val1.errors }) }
        ],
        max_output_tokens: MAX_OUTPUT_TOKENS
      });

      tpl = extractJsonObject(repair?.output_text || "");
      const val2 = validateTemplateShape(tpl);

      if (!val2.ok) {
        return json(200, {
          ok: false,
          error: "AI template still invalid after repair",
          errors: val2.errors,
          raw: (repair?.output_text || "").slice(0, 4000)
        });
      }
    }

    // 4) Return template JSON
    return json(200, { ok: true, template: tpl });
  } catch (err) {
    console.error("onyou-generate error:", err);
    return json(500, { error: "Server error", detail: String(err?.message || err) });
  }
}

/* ------------------------ prompts ------------------------ */

const SYSTEM_PROMPT = `
You generate a single JSON object that defines a template for OnYou Form Builder.
Return ONLY valid JSON. No markdown, no code fences, no commentary.

Rules:
- Output must be ONE JSON object.
- Use this top-level shape:
  {
    "meta": { "id","title","kind","category","version","access","tags" },
    "brand": { "allowLogo","allowAccent","defaults" },
    "model": { "fields": [], "collections": [] },
    "layout": { "pages": [ { "id": "p1", "blocks": [] } ] },
    "logic": { "rules": [] }
  }

meta.kind must be one of: "form" | "document" | "resume"
meta.category: "career" | "legal" | "operations" | "hr" | "general"
meta.version: "1.0.0"

access: { "toolbox": true, "vault": true, "vaultSku": "<string>" }

Fields:
- Each field must have: id, type, label, required, group (string)
- type must be one of: "text","textarea","email","date","number","select"
- If type is "select", include "options": [ ... ]

Collections:
- Use for repeatable sections (resume work history, references, etc.)
- Each collection must have: id, label, min, max, itemFields[]

Blocks:
- Allowed block types: "heading","headingSmall","paragraph","list","kv","collection","signatureRow","block"
- Use merge tags like {{fieldId}} in block text values.
- Every page must have an id and blocks array.

Logic (optional):
- rules are objects: { id, when:{field,op,value?}, then:{hideBlocks?,showBlocks?,hideFields?,showFields?,requireFields?,unrequireFields?} }
- op must be one of: equals, notEquals, contains, isEmpty, isNotEmpty, gt, gte, lt, lte

Quality requirements:
- Keep it professional and broadly applicable.
- Include sensible default fields for the requested template.
- Layout must match the model: use {{fieldId}} and collection blocks.
`;

function buildUserPrompt({ prompt, kindHint, categoryHint }) {
  const hints = [];
  if (kindHint) hints.push(`Kind hint: ${kindHint}`);
  if (categoryHint) hints.push(`Category hint: ${categoryHint}`);
  const hintText = hints.length ? `\n\n${hints.join("\n")}\n` : "\n";

  return `Create an OnYou template based on this request:${hintText}\n${prompt}\n\nReturn ONLY the JSON object.`;
}

const REPAIR_SYSTEM_PROMPT = `
You repair invalid JSON output for the OnYou Form Builder template schema.
Return ONLY valid JSON. No markdown, no commentary.

You will be given the original output text and a list of validation errors.
Produce a corrected single JSON object matching the required schema.
`;


function buildRepairPrompt({ originalText, errors }) {
  return `Original output text (may contain extra text or invalid JSON):
${originalText}

Validation errors:
${errors.join("\n")}

Return ONLY the corrected JSON object.`;
}

/* ------------------------ OpenAI call ------------------------ */

// Uses OpenAI Responses API
async function callOpenAI(apiKey, { model, messages, max_output_tokens }) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: messages,
      max_output_tokens
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${text.slice(0, 600)}`);
  }

  const data = await res.json();

  // Attempt to pull text output
  const outputText = extractOutputText(data);
  return { output_text: outputText, raw: data };
}

function extractOutputText(data) {
  // Responses API can return content in different shapes.
  // We'll best-effort grab all text.
  try {
    if (typeof data.output_text === "string") return data.output_text;
  } catch {}

  let text = "";
  const out = data.output || [];
  for (const item of out) {
    const content = item.content || [];
    for (const c of content) {
      if (c.type === "output_text" && typeof c.text === "string") text += c.text;
      if (c.type === "text" && typeof c.text === "string") text += c.text;
    }
  }
  return text || "";
}

/* ------------------------ validation ------------------------ */

function validateTemplateShape(tpl) {
  const errors = [];
  if (!tpl || typeof tpl !== "object") return { ok: false, errors: ["Template is not an object."] };

  if (!tpl.meta || typeof tpl.meta !== "object") errors.push("Missing meta object.");
  else {
    if (!tpl.meta.id) errors.push("meta.id is required.");
    if (!tpl.meta.title) errors.push("meta.title is required.");
    if (!["form", "document", "resume"].includes(tpl.meta.kind)) errors.push("meta.kind must be form|document|resume.");
    if (!tpl.meta.category) errors.push("meta.category is required.");
    if (!tpl.meta.version) errors.push("meta.version is required.");
    if (!tpl.meta.access || typeof tpl.meta.access !== "object") errors.push("meta.access is required.");
  }

  if (!tpl.model || typeof tpl.model !== "object") errors.push("Missing model object.");
  else {
    if (!Array.isArray(tpl.model.fields)) errors.push("model.fields must be an array.");
    if (!Array.isArray(tpl.model.collections)) errors.push("model.collections must be an array.");
  }

  if (!tpl.layout || typeof tpl.layout !== "object") errors.push("Missing layout object.");
  else {
    if (!Array.isArray(tpl.layout.pages) || tpl.layout.pages.length < 1) errors.push("layout.pages must be a non-empty array.");
    else {
      for (const p of tpl.layout.pages) {
        if (!p.id) errors.push("Each page requires id.");
        if (!Array.isArray(p.blocks)) errors.push(`Page ${p.id || "(unknown)"} blocks must be array.`);
      }
    }
  }

  // field id uniqueness
  const ids = new Set();
  for (const f of (tpl.model?.fields || [])) {
    if (!f.id) errors.push("Field missing id.");
    else if (ids.has(f.id)) errors.push(`Duplicate field id: ${f.id}`);
    else ids.add(f.id);
  }

  return { ok: errors.length === 0, errors };
}

/* ------------------------ helpers ------------------------ */

function extractJsonObject(text) {
  const s = String(text || "").trim();
  if (!s) return null;

  // Try direct parse first
  const direct = tryParseJson(s);
  if (direct) return direct;

  // Otherwise try to find first {...} region
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = s.slice(start, end + 1);
    const parsed = tryParseJson(slice);
    if (parsed) return parsed;
  }

  return null;
}

function tryParseJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function safeJson(s) {
  try { return JSON.parse(s || "{}"); } catch { return {}; }
}

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(obj)
  };
}

function clampInt(v, fallback, min, max) {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
