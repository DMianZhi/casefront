import { expect, it } from 'vitest';
import { buildInventory } from '../lib/exporter';
import type { ClassifiedElement, InventoryMeta } from '../lib/inventory';

it('按契约组装且 selected 默认 true、递增 id', () => {
  const inv = buildInventory({
    meta: { page_url: 'https://x/reg', page_title: '注册', session_id: '2026-09-14_注册页', plugin_version: '0.1.0' } as InventoryMeta,
    sure: [{ tempId: 1, interaction_type: 'text_input', confidence: 0.95, name: '手机号', hints: { css_selector: '#phone' }, constraints: { required: true }, state: { disabled: false } }] as unknown as ClassifiedElement[],
    review: [],
    unclassified: [{ tempId: 99, role: 'genericContainer', name: '' }] as unknown as ClassifiedElement[],
  });
  expect(inv.schema_version).toBe('0.1');
  expect(inv.meta.session_id).toBe('2026-09-14_注册页');
  expect(inv.meta.captured_at).toBeTruthy();
  expect(inv.elements[0]!.id).toBe('e001');
  expect(inv.elements[0]!.selected).toBe(true);
  expect(inv.elements[0]!.visibility).toBe('visible');
  expect(inv.unclassified.length).toBe(1);
});
