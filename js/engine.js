import { evaluateLogic } from "./logic.js";

export function buildInitialState(template){
  const values = {};
  for (const f of template.model.fields){
    if ("defaultValue" in f) values[f.id] = f.defaultValue;
    else values[f.id] = "";
  }
  const collections = {};
  for (const c of template.model.collections){
    collections[c.id] = [];
    const min = Math.max(0, c.min ?? 0);
    for (let i=0; i<min; i++){
      collections[c.id].push(makeCollectionItem(c));
    }
  }
  return { templateId: template.meta.id, values, collections, meta:{ lastSavedAt:null } };
}

function makeCollectionItem(collectionDef){
  const obj = {};
  for (const f of (collectionDef.itemFields || [])){
    obj[f.id] = ("defaultValue" in f) ? f.defaultValue : "";
  }
  obj._id = crypto.randomUUID();
  return obj;
}

export function renderBuilder({ template, state, mountEl, onChange }){
  const logic = evaluateLogic(template, state);

  mountEl.innerHTML = "";

  // Sections: simple grouping by "group" property or single default
  const groups = groupFields(template.model.fields);

  for (const [groupName, fields] of groups){
    const sec = document.createElement("div");
    sec.className = "section";

    const head = document.createElement("div");
    head.className = "section-head";
    head.innerHTML = `
      <div class="section-title">${escapeHtml(groupName)}</div>
      <div class="pill">${escapeHtml(template.meta.kind)} • ${escapeHtml(template.meta.category)}</div>
    `;
    sec.appendChild(head);

    for (const f of fields){
      if (logic.hiddenFields.has(f.id)) continue;
      sec.appendChild(renderField(f, state.values[f.id], (val)=>{
        state.values[f.id] = val;
        onChange();
      }, logic.requiredOverrides));
    }

    // Collections rendered after fields (v1)
    for (const c of (template.model.collections || [])){
      sec.appendChild(renderCollection(c, state, onChange));
    }

    mountEl.appendChild(sec);
  }
}

function groupFields(fields){
  const map = new Map();
  for (const f of fields){
    const g = f.group || "Details";
    if (!map.has(g)) map.set(g, []);
    map.get(g).push(f);
  }
  return map;
}

function renderField(def, value, setValue, requiredOverrides){
  const wrap = document.createElement("div");
  wrap.className = "field";

  const required = requiredOverrides?.has(def.id) ? requiredOverrides.get(def.id) : !!def.required;

  const labelRow = document.createElement("div");
  labelRow.className = "label-row";
  labelRow.innerHTML = `
    <div class="label">${escapeHtml(def.label || def.id)} ${required ? `<span class="pill" title="Required">Required</span>` : ""}</div>
  `;
  wrap.appendChild(labelRow);

  let el;

  if (def.type === "textarea"){
    el = document.createElement("textarea");
    el.className = "textarea";
    el.rows = def.rows || 4;
    el.value = value ?? "";
  } else if (def.type === "select"){
    el = document.createElement("select");
    el.className = "select";
    const opts = def.options || [];
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "— Select —";
    el.appendChild(empty);
    for (const o of opts){
      const op = document.createElement("option");
      op.value = o;
      op.textContent = o;
      el.appendChild(op);
    }
    el.value = value ?? "";
  } else {
    el = document.createElement("input");
    el.className = "input";
    el.type = def.type === "number" ? "number" : (def.type === "date" ? "date" : "text");
    if (def.type === "email") el.type = "email";
    el.value = value ?? "";
  }

  el.placeholder = def.placeholder || "";
  el.addEventListener("input", ()=> setValue(el.value));
  wrap.appendChild(el);

  return wrap;
}

function renderCollection(collectionDef, state, onChange){
  const wrap = document.createElement("div");
  wrap.className = "field";

  const title = document.createElement("div");
  title.className = "label-row";
  title.innerHTML = `<div class="label">${escapeHtml(collectionDef.label || collectionDef.id)}</div>`;
  wrap.appendChild(title);

  const items = state.collections[collectionDef.id] || [];
  const list = document.createElement("div");
  list.style.display = "grid";
  list.style.gap = "10px";

  for (const item of items){
    const card = document.createElement("div");
    card.className = "section";
    card.style.background = "rgba(255,255,255,.01)";

    const head = document.createElement("div");
    head.className = "section-head";
    head.innerHTML = `
      <div class="section-title">${escapeHtml(collectionDef.label)} Item</div>
      <button class="btn btn-ghost" type="button">Remove</button>
    `;
    const btnRemove = head.querySelector("button");
    btnRemove.addEventListener("click", ()=>{
      state.collections[collectionDef.id] = items.filter(x => x._id !== item._id);
      onChange();
    });

    card.appendChild(head);

    for (const f of (collectionDef.itemFields || [])){
      const value = item[f.id] ?? "";
      card.appendChild(renderField(f, value, (val)=>{
        item[f.id] = val;
        onChange();
      }));
    }

    list.appendChild(card);
  }

  const controls = document.createElement("div");
  controls.style.display = "flex";
  controls.style.gap = "10px";
  controls.style.marginTop = "10px";

  const btnAdd = document.createElement("button");
  btnAdd.className = "btn";
  btnAdd.type = "button";
  btnAdd.textContent = `Add ${collectionDef.label || "Item"}`;
  btnAdd.addEventListener("click", ()=>{
    const max = collectionDef.max ?? 99;
    if (items.length >= max) return;
    items.push(makeCollectionItem(collectionDef));
    state.collections[collectionDef.id] = items;
    onChange();
  });

  controls.appendChild(btnAdd);

  wrap.appendChild(list);
  wrap.appendChild(controls);
  return wrap;
}

export function renderPreview({ template, state, mountEl }){
  const logic = evaluateLogic(template, state);
  const html = renderPages(template, state, logic);
  mountEl.innerHTML = html;
}

export function renderPrintHtml({ template, state }){
  const logic = evaluateLogic(template, state);
  return renderPages(template, state, logic);
}

function renderPages(template, state, logic){
  const title = escapeHtml(template.meta.title);
  const sub = escapeHtml(`${template.meta.kind} • ${template.meta.category} • v${template.meta.version}`);

  let body = "";
  for (const page of template.layout.pages){
    for (const block of (page.blocks || [])){
      if (block.id && logic.hiddenBlocks.has(block.id)) continue;
      body += renderBlock(block, template, state);
    }
  }

  return `
    <div class="paper">
      <div class="paper-header">
        <div>
          <div class="paper-title">${title}</div>
          <div class="paper-sub">${sub}</div>
        </div>
        <div class="pill" style="border-color: rgba(37,99,235,.25); color:#0b1220; background: rgba(37,99,235,.15);">
          OnYou
        </div>
      </div>
      <div class="paper-body">
        ${body}
      </div>
    </div>
  `;
}

function renderBlock(block, template, state){
  const type = block.type;

  if (type === "heading"){
    return `<div class="block"><h3>${escapeHtml(interpolate(block.text || "", state))}</h3></div>`;
  }
  if (type === "headingSmall"){
    return `<div class="block"><h3 style="font-size:13px; text-transform:uppercase; letter-spacing:.08em; color:var(--paperMuted)">${escapeHtml(interpolate(block.text || "", state))}</h3></div>`;
  }
  if (type === "paragraph"){
    const text = escapeHtml(interpolate(block.text || "", state));
    if (!text.trim()) return "";
    return `<div class="block"><p>${text}</p></div>`;
  }
  if (type === "list"){
    const items = (block.items || []).map(x => `<li>${escapeHtml(interpolate(x, state))}</li>`).join("");
    return `<div class="block"><ul style="margin:0; padding-left:18px; line-height:1.45">${items}</ul></div>`;
  }
  if (type === "kv"){
    const items = (block.items || []).map(it => {
      const v = escapeHtml(interpolate(it.v || "", state));
      if (!v.trim()) return "";
      return `
        <div class="kv-item">
          <div class="kv-k">${escapeHtml(it.k || "")}</div>
          <div class="kv-v">${v}</div>
        </div>
      `;
    }).join("");
    return `<div class="block"><div class="kv">${items}</div></div>`;
  }
  if (type === "collection"){
    const cId = block.collectionId;
    const cDef = (template.model.collections || []).find(c => c.id === cId);
    if (!cDef) return "";
    const items = state.collections?.[cId] || [];
    if (!items.length) return "";
    const rows = items.map(item => renderCollectionPreview(cDef, item)).join("");
    return `<div class="block">${rows}</div>`;
  }
  if (type === "signatureRow"){
    const items = (block.items || []).map(it => {
      const v = escapeHtml(interpolate(it.value || "", state));
      return `<div class="sig"><div style="font-weight:700; color:#0b1220">${v || "&nbsp;"}</div>${escapeHtml(it.label || "Signature")}</div>`;
    }).join("");
    return `<div class="block"><div class="signature-row">${items}</div></div>`;
  }
  if (type === "block"){
    // subtype currently supports paragraph
    if (block.subtype === "paragraph"){
      const text = escapeHtml(interpolate(block.text || "", state));
      if (!text.trim()) return "";
      return `<div class="block"><p>${text}</p></div>`;
    }
  }

  return "";
}

function renderCollectionPreview(cDef, item){
  const parts = [];
  for (const f of (cDef.itemFields || [])){
    const v = String(item[f.id] ?? "").trim();
    if (!v) continue;
    parts.push(`<div><span style="color:var(--paperMuted); font-size:12px">${escapeHtml(f.label || f.id)}:</span> <strong>${escapeHtml(v)}</strong></div>`);
  }
  return `
    <div style="border:1px solid var(--paperBorder); border-radius:12px; padding:12px; margin:10px 0;">
      ${parts.join("")}
    </div>
  `;
}

function interpolate(str, state){
  return String(str).replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
    const v = state?.values?.[key];
    return (v === null || v === undefined) ? "" : String(v);
  });
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
