import { expect, it } from 'vitest';
import { buildInventory } from '../lib/exporter';
import type { ClassifiedElement, GroupInfo, InventoryMeta } from '../lib/inventory';

const meta = { page_url: 'https://x/t', page_title: '测试', session_id: 's1', plugin_version: '0.1.0' } as InventoryMeta;

const cand = (name: string, role = 'button', conf = 0.95, group: GroupInfo | null = null): ClassifiedElement => ({
  role, name, confidence: conf, visible: true,
  ...(group ? { __group: group } : {}),
} as unknown as ClassifiedElement);

it('普通元素输出不含 group 字段（向后兼容）', () => {
  const inv = buildInventory({ meta, sure: [cand('搜索')], review: [], unclassified: [] });
  expect(inv.elements.length).toBe(1);
  expect(inv.elements[0]!.group).toBeUndefined();
  expect(inv.elements[0]!.label).toBe('搜索');
});

it('组元素透传 __group 元数据（kind/signature/member_count）', () => {
  const g = { kind: 'suffix' as const, signature: '0', member_count: 650 };
  const inv = buildInventory({ meta, sure: [cand('乌鸦 0', 'button', 0.95, g)], review: [], unclassified: [] });
  expect(inv.elements[0]!.group!.kind).toBe('suffix');
  expect(inv.elements[0]!.group!.signature).toBe('0');
  expect(inv.elements[0]!.group!.member_count).toBe(650);
});

it('组元素 notes 自动记录折叠说明，人读不丢上下文', () => {
  const g = { kind: 'prefix' as const, signature: '复制 路径 ', member_count: 19 };
  const inv = buildInventory({ meta, sure: [cand('复制 路径 A', 'button', 0.95, g)], review: [], unclassified: [] });
  expect(inv.elements[0]!.notes).toMatch(/折叠/);
  expect(inv.elements[0]!.notes).toMatch(/19/);
});
