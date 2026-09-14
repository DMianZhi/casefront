import { test } from 'node:test';
import assert from 'node:assert/strict';
import { denoise } from '../src/denoiser.js';

const cand = (over = {}) => ({ role: 'button', name: 'x', properties: [], bounds: { width: 10, height: 10 }, visible: true, ...over });

test('零尺寸与 hidden 元素被移除并给出理由', () => {
  const { kept, dropped } = denoise([
    cand(),
    cand({ bounds: { width: 0, height: 0 } }),
    cand({ visible: false }),
    cand({ properties: [{ name: 'hidden', value: { type: 'boolean', value: true } }] }),
  ]);
  assert.equal(kept.length, 1);
  assert.deepEqual(dropped.map(d => d.reason).sort(), ['hidden', 'hidden', 'zero-size']);
});

test('回归：无 bounds 的真实候选不被零尺寸规则误杀（存疑不删）', () => {
  const { kept, dropped } = denoise([cand({ bounds: undefined })]);
  assert.equal(kept.length, 1);
  assert.deepEqual(dropped, []);
});

test('disabled 元素保留且标注状态，不进 dropped', () => {
  const { kept } = denoise([cand({ properties: [{ name: 'disabled', value: { type: 'boolean', value: true } }] })]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].state.disabled, true);
});
