import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInventory } from '../src/exporter.js';

test('按契约组装且 selected 默认 true、递增 id', () => {
  const inv = buildInventory({
    meta: { page_url: 'https://x/reg', page_title: '注册', session_id: '2026-09-14_注册页', plugin_version: '0.1.0' },
    sure: [{ tempId: 1, interaction_type: 'text_input', confidence: 0.95, name: '手机号', hints: { css_selector: '#phone' }, constraints: { required: true }, state: { disabled: false } }],
    review: [],
    unclassified: [{ tempId: 99, role: 'genericContainer', name: '' }],
  });
  assert.equal(inv.schema_version, '0.1');
  assert.equal(inv.meta.session_id, '2026-09-14_注册页');
  assert.ok(inv.meta.captured_at);
  assert.equal(inv.elements[0].id, 'e001');
  assert.equal(inv.elements[0].selected, true);
  assert.equal(inv.elements[0].visibility, 'visible');
  assert.equal(inv.unclassified.length, 1);
});
