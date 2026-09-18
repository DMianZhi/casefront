import { expect, it } from 'vitest';
import { applySelections, reconcileElements } from '../lib/selection';
import type { InventoryElement } from '../lib/inventory';

const el = (id: string, selected = true, notes = ''): InventoryElement => ({
  id, interaction_type: 'button', label: '按钮',
  hints: { css_selector: null, aria_path: null, placeholder: null },
  constraints: { required: null, maxlength: null, pattern: null, input_type: null, disabled: false },
  visibility: 'visible', confidence: 0.95, selected, notes,
});

it('applySelections：按 id 批量改写 selected，其余不动', () => {
  const els = [el('e001'), el('e002'), el('e003', false)];
  const out = applySelections(els, { e002: false, e003: true });
  expect(out[0]!.selected).toBe(true);
  expect(out[1]!.selected).toBe(false);
  expect(out[2]!.selected).toBe(true);
});

it('applySelections：未知 id 忽略（契约健壮）', () => {
  const els = [el('e001')];
  const out = applySelections(els, { e999: false });
  expect(out.length).toBe(1);
  expect(out[0]!.selected).toBe(true);
});

it('reconcileElements：新清单 vs 上次选择，同 id 继承勾选，新元素默认 true', () => {
  const prev = [el('e001', false), el('e002', false)];
  const next = [el('e001'), el('e003')]; // e002 消失，e003 新增
  const out = reconcileElements(next, prev);
  const by = Object.fromEntries(out.map(e => [e.id, e.selected]));
  expect(by.e001).toBe(false); // 继承上次
  expect(by.e003).toBe(true);  // 新元素默认纳入
});

it('reconcileElements：无上次记录 → 全部默认 true', () => {
  const out = reconcileElements([el('e001'), el('e002', false)], null);
  expect(out.every(e => e.selected === true)).toBeTruthy();
});
