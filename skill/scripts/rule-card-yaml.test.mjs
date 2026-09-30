// parseRuleCard 单测:受控 YAML 子集(设计文档 2026-09-29 §4.1/§6)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRuleCard } from './lib/rule-card-yaml.mjs';

const VALID = `id: text-input-project
applies_to: text_input
rules:
  - id: phone-11-digits
    title: 手机号 11 位
    detail: 手机号字段必须为 11 位数字
    priority: P1
    scope:
      match_label: ["手机号", "电话", "mobile"]
      match_selector: ["input[type=tel]"]
  - id: empty-submit
    title: 空值提交
    priority: P0
`;

test('解析合法卡:顶层字段、两条规则、scope 数组', () => {
  const { card, errors } = parseRuleCard(VALID);
  assert.deepEqual(errors, []);
  assert.equal(card.id, 'text-input-project');
  assert.equal(card.applies_to, 'text_input');
  assert.equal(card.rules.length, 2);
  assert.equal(card.rules[0].id, 'phone-11-digits');
  assert.equal(card.rules[0].detail, '手机号字段必须为 11 位数字');
  assert.deepEqual(card.rules[0].scope.match_label, ['手机号', '电话', 'mobile']);
  assert.deepEqual(card.rules[0].scope.match_selector, ['input[type=tel]']);
  assert.equal(card.rules[1].scope, undefined);
});

test('标量值引号剥离与数组空值', () => {
  const { card, errors } = parseRuleCard(
    'id: "quoted-card"\napplies_to: \'select\'\nrules:\n  - id: a\n    title: x\n    scope:\n      match_label: []\n'
  );
  assert.deepEqual(errors, []);
  assert.equal(card.id, 'quoted-card');
  assert.equal(card.applies_to, 'select');
  assert.deepEqual(card.rules[0].scope.match_label, []);
});

test('整行注释与空行被忽略', () => {
  const { card, errors } = parseRuleCard(
    '# 顶部注释\n\nid: c\napplies_to: button\nrules:\n  # 规则注释\n  - id: r1\n    title: t\n'
  );
  assert.deepEqual(errors, []);
  assert.equal(card.rules.length, 1);
});

test('未知顶层键报错且带行号', () => {
  const { errors } = parseRuleCard('id: c\napplies_to: button\nfoo: bar\nrules: []\n');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].line, 3);
  assert.match(errors[0].message, /未知顶层键/);
});

test('scope 下未知键报错', () => {
  const { errors } = parseRuleCard(
    'id: c\napplies_to: button\nrules:\n  - id: r\n    title: t\n    scope:\n      match_label: ["a"]\n      bogus: ["b"]\n'
  );
  assert.equal(errors.length, 1);
  assert.equal(errors[0].line, 8);
  assert.match(errors[0].message, /scope 下未知键/);
});

test('规则级未知键报错且不存入卡(拼写错误 detal)', () => {
  const { card, errors } = parseRuleCard(
    'id: c\napplies_to: button\nrules:\n  - id: r\n    title: t\n    detal: 拼错了\n'
  );
  assert.equal(errors.length, 1);
  assert.equal(errors[0].line, 6);
  assert.match(errors[0].message, /规则下未知键/);
  assert.equal(card.rules[0].detal, undefined);
});

test('数组未闭合报错', () => {
  const { errors } = parseRuleCard(
    'id: c\napplies_to: button\nrules:\n  - id: r\n    title: t\n    scope:\n      match_label: ["a"\n'
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /数组未闭合/);
});

test('值含歧义冒号要求加引号', () => {
  const { errors } = parseRuleCard(
    'id: c\napplies_to: button\nrules:\n  - id: r\n    title: t\n    detail: 输入 a: b 混合\n'
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /加引号/);
});

test('列表项缩进非 2 报错', () => {
  const { errors } = parseRuleCard(
    'id: c\napplies_to: button\nrules:\n    - id: r\n'
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /缩进/);
});
