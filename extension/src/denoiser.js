const prop = (c, name) => c.properties.find(p => p.name === name)?.value?.value;

export function denoise(candidates) {
  const kept = [], dropped = [];
  for (const c of candidates) {
    const b = c.bounds ?? {};
    if ((b.width ?? 0) === 0 || (b.height ?? 0) === 0) { dropped.push({ ...c, reason: 'zero-size' }); continue; }
    if (c.visible === false || prop(c, 'hidden') === true) { dropped.push({ ...c, reason: 'hidden' }); continue; }
    const disabled = prop(c, 'disabled') === true;
    kept.push({ ...c, state: { disabled } });
  }
  return { kept, dropped };
}
