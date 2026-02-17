// js/ai.js
export async function generateTemplateWithAI(prompt, opts = {}) {
  const res = await fetch("/.netlify/functions/onyou-generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      kind: opts.kind || "",       // optional hint
      category: opts.category || "" // optional hint
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI endpoint error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  if (!data.ok) {
    // Surface repair failure details for debugging
    const msg = data.error || "AI returned invalid template";
    const details = (data.errors || []).join(" | ");
    throw new Error(`${msg}${details ? " — " + details : ""}`);
  }

  return data.template;
}
