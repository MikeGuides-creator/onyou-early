export function downloadText(filename, text){
  const blob = new Blob([text], { type:"text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function toTxt(template, state){
  const lines = [];
  lines.push(template.meta.title);
  lines.push(`${template.meta.kind} • ${template.meta.category} • v${template.meta.version}`);
  lines.push("");
  for (const f of template.model.fields){
    const v = (state.values?.[f.id] ?? "").toString().trim();
    if (!v) continue;
    lines.push(`${f.label || f.id}: ${v}`);
  }
  for (const c of (template.model.collections || [])){
    const items = state.collections?.[c.id] || [];
    if (!items.length) continue;
    lines.push("");
    lines.push(`${c.label || c.id}:`);
    items.forEach((item, idx)=>{
      lines.push(`  Item ${idx+1}:`);
      for (const f of (c.itemFields || [])){
        const v = (item[f.id] ?? "").toString().trim();
        if (!v) continue;
        lines.push(`    - ${f.label || f.id}: ${v}`);
      }
    });
  }
  return lines.join("\n");
}

export function toMd(template, state){
  const lines = [];
  lines.push(`# ${template.meta.title}`);
  lines.push(`_${template.meta.kind} • ${template.meta.category} • v${template.meta.version}_`);
  lines.push("");

  for (const f of template.model.fields){
    const v = (state.values?.[f.id] ?? "").toString().trim();
    if (!v) continue;
    lines.push(`- **${escapeMd(f.label || f.id)}:** ${escapeMd(v)}`);
  }

  for (const c of (template.model.collections || [])){
    const items = state.collections?.[c.id] || [];
    if (!items.length) continue;
    lines.push("");
    lines.push(`## ${escapeMd(c.label || c.id)}`);
    items.forEach((item, idx)=>{
      lines.push(`### Item ${idx+1}`);
      for (const f of (c.itemFields || [])){
        const v = (item[f.id] ?? "").toString().trim();
        if (!v) continue;
        lines.push(`- **${escapeMd(f.label || f.id)}:** ${escapeMd(v)}`);
      }
      lines.push("");
    });
  }

  return lines.join("\n");
}

function escapeMd(s){
  return String(s).replaceAll("|","\\|");
}
