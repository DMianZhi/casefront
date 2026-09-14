import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INTERACTION_TYPES, CONF_THRESHOLD, CONF_HIGH } from '../src/constants.js';

test('interaction_type 枚举为 12 种且含全部首期类型', () => {
  assert.deepEqual([...INTERACTION_TYPES].sort(), [
    'button', 'checkbox', 'date_picker', 'dialog', 'file_upload', 'link',
    'pagination', 'radio', 'select', 'tabs', 'text_input', 'textarea',
  ].sort());
});

test('置信度阈值符合 spec', () => {
  assert.equal(CONF_THRESHOLD, 0.9);
  assert.equal(CONF_HIGH, 0.95);
});
