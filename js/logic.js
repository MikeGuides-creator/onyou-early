function getValue(state, fieldId){
  return state?.values?.[fieldId];
}

function isEmpty(v){
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

function compare(op, a, b){
  if (op === "equals") return String(a ?? "") === String(b ?? "");
  if (op === "notEquals") return String(a ?? "") !== String(b ?? "");
  if (op === "contains") return String(a ?? "").toLowerCase().includes(String(b ?? "").toLowerCase());
  if (op === "isEmpty") return isEmpty(a);
  if (op === "isNotEmpty") return !isEmpty(a);

  const na = Number(a);
  const nb = Number(b);
  if (op === "gt") return na > nb;
  if (op === "gte") return na >= nb;
  if (op === "lt") return na < nb;
  if (op === "lte") return na <= nb;

  return false;
}

export function evaluateLogic(template, state){
  const hiddenBlocks = new Set();
  const hiddenFields = new Set();
  const requiredOverrides = new Map(); // fieldId -> boolean

  for (const rule of (template.logic?.rules || [])){
    const when = rule.when;
    if (!when) continue;

    const a = getValue(state, when.field);
    const pass = compare(when.op, a, when.value);

    if (!pass) continue;

    const then = rule.then || {};
    for (const b of (then.hideBlocks || [])) hiddenBlocks.add(b);
    for (const b of (then.showBlocks || [])) hiddenBlocks.delete(b);

    for (const f of (then.hideFields || [])) hiddenFields.add(f);
    for (const f of (then.showFields || [])) hiddenFields.delete(f);

    if (then.requireFields){
      for (const f of then.requireFields) requiredOverrides.set(f, true);
    }
    if (then.unrequireFields){
      for (const f of then.unrequireFields) requiredOverrides.set(f, false);
    }
  }

  return { hiddenBlocks, hiddenFields, requiredOverrides };
}
