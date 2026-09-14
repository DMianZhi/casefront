const prop = (c, name) => c.properties.find(p => p.name === name)?.value?.value;

export function denoise(candidates) {
  const kept = [], dropped = [];
  for (const c of candidates) {
    const b = c.bounds ?? {};
    // 只有显式为 0 才判零尺寸；bounds 缺失表示未知（存疑不删）
    if (b.width === 0 || b.height === 0) { dropped.push({ ...c, reason: 'zero-size' }); continue; }
    if (c.visible === false || prop(c, 'hidden') === true) { dropped.push({ ...c, reason: 'hidden' }); continue; }
    const disabled = prop(c, 'disabled') === true;
    kept.push({ ...c, state: { disabled } });
  }
  return { kept, dropped };
}
