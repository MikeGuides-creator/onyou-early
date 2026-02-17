export function normalizeTemplate(tpl){
  const t = structuredClone(tpl);

  t.meta ??= {};
  t.meta.id ??= crypto.randomUUID();
  t.meta.title ??= "Untitled";
  t.meta.kind ??= "document";
  t.meta.category ??= "general";
  t.meta.version ??= "0.0.0";
  t.meta.tags ??= [];
  t.meta.access ??= { toolbox:true, vault:true, vaultSku: null };

  t.brand ??= {};
  t.brand.allowLogo ??= true;
  t.brand.allowAccent ??= true;
  t.brand.defaults ??= {};
  t.brand.defaults.accent ??= "#2563eb";

  t.model ??= {};
  t.model.fields ??= [];
  t.model.collections ??= [];

  t.layout ??= {};
  t.layout.pages ??= [];

  t.logic ??= {};
  t.logic.rules ??= [];

  // Normalize fields
  for (const f of t.model.fields){
    f.required = !!f.required;
    if (!("defaultValue" in f) && "default" in f) f.defaultValue = f.default;
  }

  // Normalize collections
  for (const c of t.model.collections){
    c.min ??= 0;
    c.max ??= 99;
    c.itemFields ??= [];
  }

  return t;
}

export function validateTemplate(tpl){
  const errors = [];
  if (!tpl || typeof tpl !== "object") return { ok:false, errors:["Template is not an object."] };

  const meta = tpl.meta || {};
  if (!meta.id) errors.push("meta.id is required.");
  if (!meta.title) errors.push("meta.title is required.");

  const model = tpl.model || {};
  if (!Array.isArray(model.fields)) errors.push("model.fields must be an array.");
  if (!Array.isArray(model.collections)) errors.push("model.collections must be an array.");

  const layout = tpl.layout || {};
  if (!Array.isArray(layout.pages) || layout.pages.length === 0) errors.push("layout.pages must be a non-empty array.");

  // Unique field ids
  const ids = new Set();
  for (const f of (model.fields || [])){
    if (!f.id) errors.push("A field is missing id.");
    if (ids.has(f.id)) errors.push(`Duplicate field id: ${f.id}`);
    ids.add(f.id);
  }

  // Collections item field ids
  for (const c of (model.collections || [])){
    if (!c.id) errors.push("A collection is missing id.");
    const cset = new Set();
    for (const f of (c.itemFields || [])){
      if (!f.id) errors.push(`Collection ${c.id} has item field missing id.`);
      if (cset.has(f.id)) errors.push(`Duplicate item field id in collection ${c.id}: ${f.id}`);
      cset.add(f.id);
    }
  }

  // Blocks basic sanity
  for (const p of (layout.pages || [])){
    if (!p.id) errors.push("A page is missing id.");
    if (!Array.isArray(p.blocks)) errors.push(`Page ${p.id || "(unknown)"} blocks must be an array.`);
  }

  return { ok: errors.length === 0, errors };
}
