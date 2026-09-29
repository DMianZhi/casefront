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

import { mergeGaps, resolveGaps, THIN_THRESHOLD } from './validate-rules.mjs';

const gap = (over = {}) => ({
  interaction_type: 'date_picker',
  gap_type: 'thin',
  detail: '仅 2 条规则',
  suggestion: '补跨月规则',
  ...over,
});

test('THIN_THRESHOLD 为 3', () => {
  assert.equal(THIN_THRESHOLD, 3);
});

test('mergeGaps:新键追加并带 first_seen/sessions', () => {
  const out = mergeGaps([], [gap()], 's1');
  assert.deepEqual(out, [{ ...gap(), first_seen: 's1', sessions: ['s1'] }]);
});

test('mergeGaps:同键合并——sessions 去重追加、detail 覆盖、first_seen 保留', () => {
  const existing = [{ ...gap(), first_seen: 's1', sessions: ['s1'] }];
  const incoming = [gap({ detail: '仍然只有 2 条', suggestion: '换建议' })];
  const out = mergeGaps(existing, incoming, 's2');
  assert.equal(out.length, 1);
  assert.equal(out[0].first_seen, 's1');
  assert.deepEqual(out[0].sessions, ['s1', 's2']);
  assert.equal(out[0].detail, '仍然只有 2 条');
  assert.equal(out[0].suggestion, '换建议');
});

test('mergeGaps:同会话重复出现不产生重复 session', () => {
  const existing = [{ ...gap(), first_seen: 's1', sessions: ['s1'] }];
  const out = mergeGaps(existing, [gap()], 's1');
  assert.deepEqual(out[0].sessions, ['s1']);
});

test('mergeGaps:不修改入参', () => {
  const existing = [];
  mergeGaps(existing, [gap()], 's1');
  assert.deepEqual(existing, []);
});

test('resolveGaps:missing 卡已存在(>0)则移除,仍缺失则保留', () => {
  const gaps = [
    gap({ interaction_type: 'select', gap_type: 'missing' }),
    gap({ interaction_type: 'tabs', gap_type: 'missing' }),
  ];
  const counts = new Map([['select', 1], ['tabs', 0]]);
  const out = resolveGaps(gaps, counts);
  assert.equal(out.length, 1);
  assert.equal(out[0].interaction_type, 'tabs');
});

test('resolveGaps:thin 规则数达阈值移除,未达保留', () => {
  const gaps = [gap({ interaction_type: 'radio' }), gap({ interaction_type: 'dialog' })];
  const counts = new Map([['radio', THIN_THRESHOLD], ['dialog', 2]]);
  const out = resolveGaps(gaps, counts);
  assert.equal(out.length, 1);
  assert.equal(out[0].interaction_type, 'dialog');
});

test('resolveGaps:counts 缺该类型(无卡)时 missing/thin 均保留', () => {
  const gaps = [gap({ interaction_type: 'pagination' })];
  assert.equal(resolveGaps(gaps, new Map()).length, 1);
});

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runValidate, runGaps } from './validate-rules.mjs';

// 每个用例独立临时目录,结束后清理
function makeWs(files) {
  const root = mkdtempSync(join(tmpdir(), 'casefront-m2-'));
  for (const [rel, content] of Object.entries(files)) {
    const p = join(root, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content, 'utf8');
  }
  return root;
}

const BUILTIN_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures-builtin');

test('runValidate:通过目录输出 ✓ 并 ok=true', () => {
  const root = makeWs({
    'rules/text-input-project.yaml':
      'id: text-input-project\napplies_to: text_input\nrules:\n  - id: r1\n    title: t\n',
  });
  const r = runValidate(join(root, 'rules'), BUILTIN_DIR);
  assert.equal(r.ok, true);
  assert.match(r.report, /✓ 1 张卡校验通过/);
  rmSync(root, { recursive: true, force: true });
});

test('runValidate:非法卡逐条报错带文件与行号', () => {
  const root = makeWs({
    'rules/bad.yaml':
      'id: Bad_Card\napplies_to: slider\nrules: []\n',
  });
  const r = runValidate(join(root, 'rules'), BUILTIN_DIR);
  assert.equal(r.ok, false);
  assert.match(r.report, /bad\.yaml:1/); // 卡级错报在文件行 1 起
  assert.match(r.report, /kebab-case/);
  assert.match(r.report, /interaction_type/);
  rmSync(root, { recursive: true, force: true });
});

test('runValidate:正式区卡 id 重复=错误;草稿与正式同 id=告警不失败', () => {
  const card = (id) => `id: ${id}\napplies_to: button\nrules:\n  - id: r\n    title: t\n`;
  const root = makeWs({
    'rules/a-project.yaml': card('a-project'),
    'rules/b-project.yaml': card('a-project'), // 重复
    'rules/drafts/a-project.yaml': card('a-project'), // 告警
  });
  const r = runValidate(join(root, 'rules'), BUILTIN_DIR);
  assert.equal(r.ok, false);
  assert.match(r.report, /卡 id 重复/);
  assert.match(r.report, /告警/);
  rmSync(root, { recursive: true, force: true });
});

test('runGaps:--from 合并本次缺口 + 补齐移除 + 写回台账', () => {
  const root = makeWs({
    // 内置+项目合计:select 有 4 条规则 → thin 缺口应被移除;tabs 仍无卡 → 保留
    'rules/select-project.yaml':
      'id: select-project\napplies_to: select\nrules:\n  - id: a\n    title: t\n  - id: b\n    title: t\n  - id: c\n    title: t\n  - id: d\n    title: t\n',
    'rules/gaps.json': JSON.stringify({
      schema_version: '0.1',
      gaps: [{ interaction_type: 'select', gap_type: 'thin', detail: '旧', suggestion: '旧', first_seen: 's0', sessions: ['s0'] }],
    }),
    'cases.json': JSON.stringify({
      schema_version: '0.2',
      meta: { session_id: 's1' },
      rule_gaps: [
        { interaction_type: 'tabs', gap_type: 'missing', detail: '无卡', suggestion: '新建 tabs 卡' },
      ],
    }),
  });
  // 注入 fixture 内置目录:真实内置卡已覆盖全部 12 类(tabs 有 6 条规则),
  // 若用真实目录 tabs 的 missing 缺口会被清掉,场景"tabs 仍无卡 → 保留"不成立
  const r = runGaps(root, { from: join(root, 'cases.json'), builtinDir: BUILTIN_DIR });
  assert.equal(r.ok, true);
  assert.equal(r.remaining, 1);
  const saved = JSON.parse(readFileSync(join(root, 'rules/gaps.json'), 'utf8'));
  assert.equal(saved.gaps.length, 1);
  assert.equal(saved.gaps[0].interaction_type, 'tabs');
  assert.deepEqual(saved.gaps[0].sessions, ['s1']);
  rmSync(root, { recursive: true, force: true });
});

test('runGaps:--from 的 cases.json 损坏/缺失时 ok=false 且不写回台账', () => {
  const root = makeWs({
    'rules/gaps.json': JSON.stringify({ schema_version: '0.1', gaps: [] }),
    'cases.json': '{broken',
  });
  const before = readFileSync(join(root, 'rules/gaps.json'), 'utf8');
  const r = runGaps(root, { from: join(root, 'cases.json'), builtinDir: BUILTIN_DIR });
  assert.equal(r.ok, false);
  assert.match(r.report, /cases\.json/);
  assert.equal(readFileSync(join(root, 'rules/gaps.json'), 'utf8'), before);
  rmSync(root, { recursive: true, force: true });
});

test('runGaps:gaps.json 合法 JSON 但非对象(null)→ ok=false 提示结构', () => {
  const root = makeWs({ 'rules/gaps.json': 'null' });
  const r = runGaps(root, {});
  assert.equal(r.ok, false);
  assert.match(r.report, /结构/);
  rmSync(root, { recursive: true, force: true });
});

test('runGaps:gaps.json 不存在则新建;损坏则 ok=false 且不写回', () => {
  const root1 = makeWs({ 'rules/.keep': '' });
  const r1 = runGaps(root1, {});
  assert.equal(r1.ok, true);
  assert.deepEqual(JSON.parse(readFileSync(join(root1, 'rules/gaps.json'), 'utf8')), {
    schema_version: '0.1', gaps: [],
  });
  rmSync(root1, { recursive: true, force: true });

  const root2 = makeWs({ 'rules/gaps.json': '{broken' });
  const r2 = runGaps(root2, {});
  assert.equal(r2.ok, false);
  assert.match(r2.report, /gaps\.json/);
  rmSync(root2, { recursive: true, force: true });
});
