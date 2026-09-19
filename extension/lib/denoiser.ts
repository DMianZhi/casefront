import type { EnrichedCandidate } from './inventory';

const prop = (c: EnrichedCandidate, name: string): unknown =>
  c.properties.find(p => p.name === name)?.value?.value;

export function denoise(candidates: EnrichedCandidate[]): {
  kept: EnrichedCandidate[];
  dropped: (EnrichedCandidate & { reason: string })[];
} {
  const kept: EnrichedCandidate[] = [], dropped: (EnrichedCandidate & { reason: string })[] = [];
  for (const c of candidates) {
    const b = c.bounds ?? {};
    // 只有显式为 0 才判零尺寸；bounds 缺失表示未知（存疑不删）
    if (b.width === 0 || b.height === 0) { dropped.push({ ...c, reason: 'zero-size' }); continue; }
    // 微小尺寸：宽高均 <3px 的元素无法交互（如只剩边框的 0 尺寸按钮），视为不可见
    if ((b.width ?? 99) < 3 && (b.height ?? 99) < 3) { dropped.push({ ...c, reason: 'tiny-size' }); continue; }
    if (c.visible === false || prop(c, 'hidden') === true) { dropped.push({ ...c, reason: 'hidden' }); continue; }
    const disabled = prop(c, 'disabled') === true;
    kept.push({ ...c, state: { disabled } });
  }
  return { kept, dropped };
}
