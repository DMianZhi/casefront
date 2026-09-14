import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, splitByConfidence } from '../src/classifier.js';
import { CONF_HIGH, CONF_THRESHOLD } from '../src/constants.js';

const cand = (over = {}) => ({ role: 'textbox', name: 'n', properties: [], constraints: {}, state: { disabled: false }, ...over });

test('常规映射给高置信度', () => {
  const r = classify([cand(), cand({ role: 'combobox' }), cand({ role: 'checkbox', name: '同意' }),
    cand({ role: 'textbox', properties: [{ name: 'multiline', value: { type: 'boolean', value: true } }] }),
    cand({ role: 'button', constraints: { input_type: 'file' } })]);
  assert.equal(r[0].interaction_type, 'text_input');
  assert.equal(r[1].interaction_type, 'select');
  assert.equal(r[2].interaction_type, 'checkbox');
  assert.equal(r[3].interaction_type, 'textarea');
  assert.equal(r[4].interaction_type, 'file_upload');
  assert.ok(r.every(x => x.confidence === CONF_HIGH));
});

test('input_type=date 走 date_picker；低信心项由 splitByConfidence 分流', () => {
  const r = classify([cand({ role: 'button', constraints: { input_type: 'date' } })]);
  assert.equal(r[0].interaction_type, 'date_picker');
  const [sure, review, unclassified] = splitByConfidence(r);
  assert.equal(sure.length, 1);
  assert.equal(review.length, 0);
  assert.equal(unclassified.length, 0);
  const [s2, r2] = splitByConfidence([cand({ interaction_type: 'pagination', confidence: 0.6 })]);
  assert.equal(s2.length, 0);
  assert.equal(r2.length, 1);
  assert.ok(CONF_THRESHOLD === 0.9);
});
