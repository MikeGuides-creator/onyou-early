import { TEMPLATE_MANIFEST, EMBEDDED_TEMPLATES } from "./templates.js";
import { normalizeTemplate, validateTemplate } from "./schema.js";
import { buildInitialState, renderBuilder, renderPreview, renderPrintHtml } from "./engine.js";
import { downloadText, toTxt, toMd } from "./export.js";
import { generateTemplateWithAI } from "./ai.js";

const els = {
  libraryInline: document.getElementById("libraryInline"),
  builder: document.getElementById("builder"),
  preview: document.getElementById("preview"),
  printRoot: document.getElementById("printRoot"),
  docTitle: document.getElementById("docTitle"),
  docMeta: document.getElementById("docMeta"),

  btnLibrary: document.getElementById("btnLibrary"),
  btnNew: document.getElementById("btnNew"),
  btnPrint: document.getElementById("btnPrint"),
  btnExportTxt: document.getElementById("btnExportTxt"),
  btnExportMd: document.getElementById("btnExportMd"),

  aiPrompt: document.getElementById("aiPrompt"),
  btnGenerateAI: document.getElementById("btnGenerateAI"),
  aiStatus: document.getElementById("aiStatus")
};

const STORAGE_KEY = "onyou:v1:active";

let template = null;
let state = null;

init();

function init(){
  renderLibrary();
  wireActions();

  const restored = tryRestore();
  if (restored){
    template = restored.template;
    state = restored.state;
    applyTemplate();
  } else {
    // default load
    loadTemplateById(TEMPLATE_MANIFEST[0].id);
  }
}

function wireActions(){
  els.btnLibrary.addEventListener("click", ()=> {
    els.libraryInline.scrollIntoView({ behavior:"smooth", block:"start" });
  });

  els.btnNew.addEventListener("click", ()=> {
    clearSaved();
    loadTemplateById(TEMPLATE_MANIFEST[0].id);
  });

  els.btnPrint.addEventListener("click", ()=> {
    const html = renderPrintHtml({ template, state });
    els.printRoot.innerHTML = html;
    window.print();
  });

  els.btnExportTxt.addEventListener("click", ()=> {
    const text = toTxt(template, state);
    const safe = slug(template.meta.title);
    downloadText(`${safe}.txt`, text);
  });

  els.btnExportMd.addEventListener("click", ()=> {
    const text = toMd(template, state);
    const safe = slug(template.meta.title);
    downloadText(`${safe}.md`, text);
  });

  els.btnGenerateAI.addEventListener("click", async ()=>{
    const prompt = (els.aiPrompt.value || "").trim();
    if (!prompt){
      setAIStatus("Type what you need first (one or two sentences is fine).", true);
      return;
    }

    setAIStatus("Generating template…", false);
    els.btnGenerateAI.disabled = true;

    try{
      const aiTpl = await generateTemplateWithAI(prompt);
      const norm = normalizeTemplate(aiTpl);
      const v = validateTemplate(norm);
      if (!v.ok){
        setAIStatus("AI returned an invalid template. (Next step: we add an auto-repair pass.)", true);
        console.warn("Template validation errors:", v.errors);
        return;
      }
      template = norm;
      state = buildInitialState(template);
      applyTemplate();
      setAIStatus("Generated. You can now edit fields and export.", false);
    } catch (e){
      console.error(e);
      setAIStatus("AI generation failed. (Network or service error.)", true);
    } finally{
      els.btnGenerateAI.disabled = false;
    }
  });
}

function renderLibrary(){
  els.libraryInline.innerHTML = TEMPLATE_MANIFEST.map(t => {
    return `
      <div class="template-card">
        <div>
          <div class="title">${escapeHtml(t.title)}</div>
          <div class="meta">${escapeHtml(t.kind)} • ${escapeHtml(t.category)} • ${escapeHtml((t.tags||[]).slice(0,3).join(", "))}</div>
        </div>
        <button class="btn" data-tpl="${escapeHtml(t.id)}">Open</button>
      </div>
    `;
  }).join("");

  els.libraryInline.querySelectorAll("button[data-tpl]").forEach(btn=>{
    btn.addEventListener("click", ()=> loadTemplateById(btn.getAttribute("data-tpl")));
  });
}

async function loadTemplateById(id){
  const manifest = TEMPLATE_MANIFEST.find(x => x.id === id);
  if (!manifest){
    console.warn("Template not found:", id);
    return;
  }

  let raw = null;

  // 1) try fetch from /templates
  try{
    raw = await fetch(manifest.file, { cache:"no-store" }).then(r=>{
      if (!r.ok) throw new Error("Fetch failed");
      return r.json();
    });
  } catch {
    // 2) fallback to embedded
    raw = EMBEDDED_TEMPLATES[id];
  }

  const norm = normalizeTemplate(raw);
  const v = validateTemplate(norm);
  if (!v.ok){
    console.error("Template validation errors:", v.errors);
    alert("Template failed validation. Check console.");
    return;
  }

  template = norm;
  state = buildInitialState(template);
  applyTemplate();
}

function applyTemplate(){
  els.docTitle.textContent = template.meta.title;
  els.docMeta.textContent = `${template.meta.kind} • ${template.meta.category} • v${template.meta.version}`;

  const onChange = ()=>{
    // Autosave
    state.meta.lastSavedAt = new Date().toISOString();
    persist();
    // Re-render
    renderBuilder({ template, state, mountEl: els.builder, onChange });
    renderPreview({ template, state, mountEl: els.preview });
  };

  renderBuilder({ template, state, mountEl: els.builder, onChange });
  renderPreview({ template, state, mountEl: els.preview });

  persist();
}

function persist(){
  const payload = { template, state };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function tryRestore(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.template || !parsed?.state) return null;

    const norm = normalizeTemplate(parsed.template);
    const v = validateTemplate(norm);
    if (!v.ok) return null;

    return { template: norm, state: parsed.state };
  } catch {
    return null;
  }
}

function clearSaved(){
  localStorage.removeItem(STORAGE_KEY);
}

function slug(s){
  return String(s || "document")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/(^-|-$)/g,"");
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function setAIStatus(msg, isError){
  els.aiStatus.textContent = msg;
  els.aiStatus.style.color = isError ? "rgba(239,68,68,.95)" : "";
}
