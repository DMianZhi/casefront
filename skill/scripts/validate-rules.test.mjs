// validateCard 单测:规则卡语义校验(设计文档 2026-09-29 §6)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCard, INTERACTION_TYPES } from './validate-rules.mjs';

const BUILTIN = new Set(['text-input-standard', 'button-standard']);

const baseCard = (over = {}) => ({
  id: 'text-input-project',
  applies_to: 'text_input',
  rules: [{ id: 'phone-11-digits', title: '手机号 11 位' }],
  ...over,
});

test('INTERACTION_TYPES 与插件 constants.ts 逐字一致(12 值)', () => {
  assert.deepEqual(INTERACTION_TYPES, [
    'text_input', 'textarea', 'select', 'radio', 'checkbox',
    'button', 'link', 'file_upload', 'date_picker', 'pagination',
    'dialog', 'tabs',
  ]);
});

test('合法卡零错误', () => {
  assert.deepEqual(validateCard(baseCard(), BUILTIN), []);
});

test('合法卡带 scope 通过', () => {
  const c = baseCard();
  c.rules[0].scope = { match_label: ['手机号'], match_selector: ['input[type=tel]'] };
  assert.deepEqual(validateCard(c, BUILTIN), []);
});

test('缺 id / 缺 applies_to / rules 为空 → 各一条错误', () => {
  assert.equal(validateCard(baseCard({ id: '' }), BUILTIN).length, 1);
  assert.equal(validateCard(baseCard({ applies_to: '' }), BUILTIN).length, 1);
  assert.equal(validateCard(baseCard({ rules: [] }), BUILTIN).length, 1);
});

test('卡 id 非 kebab-case 报错', () => {
  const errs = validateCard(baseCard({ id: 'Text_Input' }), BUILTIN);
  assert.equal(errs.length, 1);
  assert.match(errs[0].message, /kebab-case/);
});

test('卡 id 与内置卡冲突报错', () => {
  const errs = validateCard(baseCard({ id: 'text-input-standard' }), BUILTIN);
  assert.equal(errs.length, 1);
  assert.match(errs[0].message, /内置卡/);
});

test('applies_to 不在枚举报错', () => {
  const errs = validateCard(baseCard({ applies_to: 'slider' }), BUILTIN);
  assert.equal(errs.length, 1);
  assert.match(errs[0].message, /interaction_type/);
});

test('规则缺 id / 缺 title 报错(带行内定位 ruleId=null 时报序号)', () => {
  const c = baseCard();
  c.rules[0] = { title: 't' };
  assert.match(validateCard(c, BUILTIN)[0].message, /规则 1 缺 id/);
  const c2 = baseCard();
  c2.rules[0] = { id: 'r' };
  assert.match(validateCard(c2, BUILTIN)[0].message, /「r」缺 title/);
});

test('规则 id 卡内重复报错', () => {
  const c = baseCard({
    rules: [
      { id: 'dup', title: 'a' },
      { id: 'dup', title: 'b' },
    ],
  });
  const errs = validateCard(c, BUILTIN);
  assert.equal(errs.length, 1);
  assert.match(errs[0].message, /规则 id 重复/);
});

test('priority 非法报错', () => {
  const c = baseCard();
  c.rules[0].priority = 'P9';
  assert.match(validateCard(c, BUILTIN)[0].message, /priority/);
});

test('scope 空对象 / 非数组元素报错', () => {
  const c = baseCard();
  c.rules[0].scope = {};
  assert.match(validateCard(c, BUILTIN)[0].message, /scope/);
  const c2 = baseCard();
  c2.rules[0].scope = { match_label: ['ok', 123] };
  assert.match(validateCard(c2, BUILTIN)[0].message, /match_label/);
});
