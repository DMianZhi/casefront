import { expect, it } from 'vitest';
import { foldGroups } from '../lib/fold-groups';
import type { Candidate } from '../lib/inventory';

// 输入形状 = reducer 产物（candidate）：role/name 均为字符串
const node = (nodeId: string, role: string, name: string, parentId: string | null = null, backendDOMNodeId: string | null = null): Candidate & { nodeId: string; name: string; role: string } => ({
  nodeId, parentId, role, name, backendDOMNodeId, ignored: false, properties: [],
});

it('同父同角色兄弟≥5 → 折叠为一个 group 项（零计数标签等价类）', () => {
  const nodes = [
    node('2', 'button', '乌鸦 0', '1', '11'),
    node('3', 'button', '麻雀 0', '1', '12'),
    node('4', 'button', '燕子 0', '1', '13'),
    node('5', 'button', '鸽子 0', '1', '14'),
    node('5b', 'button', '鹤 0', '1', '15'),
    node('5c', 'button', '35人英雄三国杀 0', '1', '16'),
  ];
  const out = foldGroups(nodes);
  expect(out.groups.length).toBe(1);
  expect(out.groups[0]!.representative.name).toBe('乌鸦 0');
  expect(out.groups[0]!.memberCount).toBe(6);
  expect(out.groups[0]!.role).toBe('button');
  expect(out.singles.length).toBe(0);
});

it('兄弟<5 不折叠', () => {
  const nodes = [
    node('2', 'button', '全', '1', '11'),
    node('3', 'button', '人物', '1', '12'),
    node('4', 'button', '动物', '1', '13'),
    node('5', 'button', '武器', '1', '14'),
  ];
  const out = foldGroups(nodes, { minSiblings: 5 });
  expect(out.groups.length).toBe(0);
  expect(out.singles.length).toBe(4);
});

it('同名兄弟（「复制」类按钮）折叠，异类名保持独立', () => {
  const nodes = [
    node('2', 'button', '复制 路径 A', '1', '11'),
    node('3', 'button', '复制 路径 B', '1', '12'),
    node('4', 'button', '复制 路径 C', '1', '13'),
    node('5', 'button', '复制 路径 D', '1', '14'),
    node('6', 'button', '复制 路径 E', '1', '15'),
    node('7', 'button', '搜索', '1', '16'),
  ];
  const out = foldGroups(nodes);
  expect(out.groups.length).toBe(1);
  expect(out.groups[0]!.memberCount).toBe(5);
  expect(out.groups[0]!.representative.name).toBe('复制 路径 A');
  expect(out.singles.length).toBe(1);
  expect(out.singles[0]!.name).toBe('搜索');
});

it('mode=full 时不折叠，全部走 singles', () => {
  const nodes = [
    node('2', 'button', '乌鸦 0', '1', '11'),
    node('3', 'button', '麻雀 0', '1', '12'),
    node('4', 'button', '燕子 0', '1', '13'),
    node('5', 'button', '鸽子 0', '1', '14'),
    node('5b', 'button', '鹤 0', '1', '15'),
    node('5c', 'button', '鹰 0', '1', '16'),
  ];
  const out = foldGroups(nodes, { mode: 'full' });
  expect(out.groups.length).toBe(0);
  expect(out.singles.length).toBe(6);
});

it('不同父节点的同名兄弟各自计数，不跨父折叠', () => {
  const nodes = [
    node('2', 'button', '复制 路径 A', 'g1', '11'),
    node('3', 'button', '复制 路径 B', 'g1', '12'),
    node('4', 'button', '复制 路径 C', 'g2', '13'),
    node('5', 'button', '复制 路径 D', 'g2', '14'),
  ];
  const out = foldGroups(nodes);
  expect(out.groups.length).toBe(0);
  expect(out.singles.length).toBe(4);
});

it('空输入安全', () => {
  const out = foldGroups([]);
  expect(out).toEqual({ singles: [], groups: [] });
});
