import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInventory } from '../src/exporter.js';

const cand = (name, role = 'button', conf = 0.95, group = null) => ({
  role, name, confidence: conf, visible: true,
  ...(group ? { __group: group } : {}),
});

test('普通元素输出不含 group 字段（向后兼容）', () => {
  const inv = buildInventory({ sure: [cand('搜索')], review: [], unclassified: [] });
  assert.equal(inv.elements.length, 1);
  assert.equal(inv.elements[0].group, undefined);
  assert.equal(inv.elements[0].label, '搜索');
});

test('组元素透传 __group 元数据（kind/signature/member_count）', () => {
  const g = { kind: 'suffix', signature: '0', member_count: 650 };
  const inv = buildInventory({ sure: [cand('乌鸦 0', 'button', 0.95, g)], review: [], unclassified: [] });
  assert.equal(inv.elements[0].group.kind, 'suffix');
  assert.equal(inv.elements[0].group.signature, '0');
  assert.equal(inv.elements[0].group.member_count, 650);
});

test('组元素 notes 自动记录折叠说明，人读不丢上下文', () => {
  const g = { kind: 'prefix', signature: '复制 路径 ', member_count: 19 };
  const inv = buildInventory({ sure: [cand('复制 路径 A', 'button', 0.95, g)], review: [], unclassified: [] });
  assert.match(inv.elements[0].notes, /折叠/);
  assert.match(inv.elements[0].notes, /19/);
});
