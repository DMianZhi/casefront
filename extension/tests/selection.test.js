import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySelections, reconcileElements } from '../src/selection.js';

const el = (id, selected = true, notes = '') => ({ id, selected, notes });

test('applySelections：按 id 批量改写 selected，其余不动', () => {
  const els = [el('e001'), el('e002'), el('e003', false)];
  const out = applySelections(els, { e002: false, e003: true });
  assert.equal(out[0].selected, true);
  assert.equal(out[1].selected, false);
  assert.equal(out[2].selected, true);
});

test('applySelections：未知 id 忽略（契约健壮）', () => {
  const els = [el('e001')];
  const out = applySelections(els, { e999: false });
  assert.equal(out.length, 1);
  assert.equal(out[0].selected, true);
});

test('reconcileElements：新清单 vs 上次选择，同 id 继承勾选，新元素默认 true', () => {
  const prev = [el('e001', false), el('e002', false)];
  const next = [el('e001'), el('e003')]; // e002 消失，e003 新增
  const out = reconcileElements(next, prev);
  const by = Object.fromEntries(out.map(e => [e.id, e.selected]));
  assert.equal(by.e001, false); // 继承上次
  assert.equal(by.e003, true);  // 新元素默认纳入
});

test('reconcileElements：无上次记录 → 全部默认 true', () => {
  const out = reconcileElements([el('e001'), el('e002', false)], null);
  assert.ok(out.every(e => e.selected === true));
});
