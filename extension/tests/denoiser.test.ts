import { expect, it } from 'vitest';
import { denoise } from '../lib/denoiser';
import type { EnrichedCandidate } from '../lib/inventory';

const cand = (over: Partial<EnrichedCandidate> = {}): EnrichedCandidate => ({
  role: 'button', name: 'x', properties: [], bounds: { width: 10, height: 10 }, visible: true,
  backendDOMNodeId: null, ignored: false,
  hints: { css_selector: null, aria_path: null, placeholder: null },
  constraints: { required: null, maxlength: null, pattern: null, input_type: null, disabled: false },
  state: { disabled: false }, ...over,
});

it('零尺寸与 hidden 元素被移除并给出理由', () => {
  const { kept, dropped } = denoise([
    cand(),
    cand({ bounds: { width: 0, height: 0 } }),
    cand({ visible: false }),
    cand({ properties: [{ name: 'hidden', value: { type: 'boolean', value: true } }] }),
  ]);
  expect(kept.length).toBe(1);
  expect(dropped.map(d => d.reason).sort()).toEqual(['hidden', 'hidden', 'zero-size']);
});

it('回归：无 bounds 的真实候选不被零尺寸规则误杀（存疑不删）', () => {
  const { kept, dropped } = denoise([cand({ bounds: undefined })]);
  expect(kept.length).toBe(1);
  expect(dropped).toEqual([]);
});

it('disabled 元素保留且标注状态，不进 dropped', () => {
  const { kept } = denoise([cand({ properties: [{ name: 'disabled', value: { type: 'boolean', value: true } }] })]);
  expect(kept.length).toBe(1);
  expect(kept[0]!.state.disabled).toBe(true);
});
