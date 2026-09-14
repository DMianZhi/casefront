import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foldGroups } from '../src/fold-groups.js';

// 输入形状 = reducer 产物（candidate）：role/name 均为字符串
const node = (nodeId, role, name, parentId = null, backendDOMNodeId = null) => ({
  nodeId, parentId, role, name, backendDOMNodeId,
});

test('同父同角色兄弟≥5 → 折叠为一个 group 项（零计数标签等价类）', () => {
  const nodes = [
    node('2', 'button', '乌鸦 0', '1', '11'),
    node('3', 'button', '麻雀 0', '1', '12'),
    node('4', 'button', '燕子 0', '1', '13'),
    node('5', 'button', '鸽子 0', '1', '14'),
    node('5b', 'button', '鹤 0', '1', '15'),
    node('5c', 'button', '35人英雄三国杀 0', '1', '16'),
  ];
  const out = foldGroups(nodes);
  assert.equal(out.groups.length, 1);
  assert.equal(out.groups[0].representative.name, '乌鸦 0');
  assert.equal(out.groups[0].memberCount, 6);
  assert.equal(out.groups[0].role, 'button');
  assert.equal(out.singles.length, 0);
});

test('兄弟<5 不折叠', () => {
  const nodes = [
    node('2', 'button', '全', '1', '11'),
    node('3', 'button', '人物', '1', '12'),
    node('4', 'button', '动物', '1', '13'),
    node('5', 'button', '武器', '1', '14'),
  ];
  const out = foldGroups(nodes, { minSiblings: 5 });
  assert.equal(out.groups.length, 0);
  assert.equal(out.singles.length, 4);
});

test('同名兄弟（「复制」类按钮）折叠，异类名保持独立', () => {
  const nodes = [
    node('2', 'button', '复制 路径 A', '1', '11'),
    node('3', 'button', '复制 路径 B', '1', '12'),
    node('4', 'button', '复制 路径 C', '1', '13'),
    node('5', 'button', '复制 路径 D', '1', '14'),
    node('6', 'button', '复制 路径 E', '1', '15'),
    node('7', 'button', '搜索', '1', '16'),
  ];
  const out = foldGroups(nodes);
  assert.equal(out.groups.length, 1);
  assert.equal(out.groups[0].memberCount, 5);
  assert.equal(out.groups[0].representative.name, '复制 路径 A');
  assert.equal(out.singles.length, 1);
  assert.equal(out.singles[0].name, '搜索');
});

test('mode=full 时不折叠，全部走 singles', () => {
  const nodes = [
    node('2', 'button', '乌鸦 0', '1', '11'),
    node('3', 'button', '麻雀 0', '1', '12'),
    node('4', 'button', '燕子 0', '1', '13'),
    node('5', 'button', '鸽子 0', '1', '14'),
    node('5b', 'button', '鹤 0', '1', '15'),
    node('5c', 'button', '鹰 0', '1', '16'),
  ];
  const out = foldGroups(nodes, { mode: 'full' });
  assert.equal(out.groups.length, 0);
  assert.equal(out.singles.length, 6);
});

test('不同父节点的同名兄弟各自计数，不跨父折叠', () => {
  const nodes = [
    node('2', 'button', '复制 路径 A', 'g1', '11'),
    node('3', 'button', '复制 路径 B', 'g1', '12'),
    node('4', 'button', '复制 路径 C', 'g2', '13'),
    node('5', 'button', '复制 路径 D', 'g2', '14'),
  ];
  const out = foldGroups(nodes);
  assert.equal(out.groups.length, 0);
  assert.equal(out.singles.length, 4);
});

test('空输入安全', () => {
  const out = foldGroups([]);
  assert.deepEqual(out, { singles: [], groups: [] });
});
