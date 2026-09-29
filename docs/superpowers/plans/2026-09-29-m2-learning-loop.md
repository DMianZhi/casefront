# M2 学习闭环实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 casefront M2 学习闭环——临时业务规则沉淀为规则卡草稿并确认入库、规则缺口结构化并跨会话台账化、可选校验脚本兜底,使同页二次生成质量可感知提升。

**Architecture:** 全部落在 skill 侧,插件零改动。SKILL.md 管线 5 步 → 6 步(新增第 6 步「沉淀」);新增零依赖 Node 脚本 `validate-rules.mjs`(内置最小 YAML 解析器 + validate/gaps 两个子命令);契约升级:规则卡新增可选 `scope` 字段、cases.json `rule_gaps` 结构化(schema 0.2)、新增 `workspace/rules/gaps.json` 台账。设计文档:`docs/superpowers/specs/2026-09-29-m2-learning-loop-design.md`。

**Tech Stack:** Node 22+(ESM .mjs、node:test 内置测试)、YAML(受控子集,手写解析器)、纯 Markdown skill。

## Global Constraints

- Node ≥ 22.20;**脚本零第三方依赖**(禁止引入 js-yaml 等库)
- interaction_type 12 枚举(逐字,来自 `extension/lib/constants.ts`):`text_input`, `textarea`, `select`, `radio`, `checkbox`, `button`, `link`, `file_upload`, `date_picker`, `pagination`, `dialog`, `tabs`
- 内置卡 12 张,id 全部 `*-standard` 后缀(如 `text-input-standard`);脚本**动态读** `skill/references/rules/*.yaml` 取内置 id,不硬编码
- thin 阈值:**卡内规则数 < 3 = thin**;0 张卡(内置+项目合并视角)= missing
- cases.json `schema_version` 升至 **0.2**(唯一变更:`rule_gaps` 字符串数组 → 对象数组);gaps.json `schema_version` 为 **0.1**
- `workspace/` 整体在 .gitignore 中(仓库根 `.gitignore:18`)——规则卡/台账是用户侧资产,**不入库**;测试 fixture 一律内联字符串或临时目录
- 插件 `extension/lib/` 零改动;唯一插件侧改动是 `extension/scripts/build-cases.mjs` 的 schema_version 标注
- 提交信息:`<type>(<scope>): 中文描述`,结尾 `Co-Authored-By: Kscc <noreply@owtffssent.com>`
- 所有命令在仓库根 `C:\Users\admin\.wpscomate\agent\workspace\casefront` 执行(除非任务注明 `cd extension`)

---

### Task 1: 最小 YAML 解析器 `parseRuleCard`

**Files:**
- Create: `skill/scripts/lib/rule-card-yaml.mjs`
- Test: `skill/scripts/rule-card-yaml.test.mjs`

**Interfaces:**
- Consumes: 无(纯函数,无依赖)
- Produces: `parseRuleCard(text: string) → { card: { id: string, applies_to: string, rules: Array<Object> }, errors: Array<{ line: number, message: string }> }`。解析不抛异常,失败全走 `errors`;`card` 在有 errors 时可能是部分填充的,调用方必须先检查 `errors`。支持的受控语法:顶层 `id:`/`applies_to:`/`rules:`(缩进 0)、列表项 `- key: value`(缩进 2)、规则字段(缩进 4,含 `scope:` 嵌套块)、scope 字段 `match_label:`/`match_selector:`(缩进 6,flow 数组);标量可带单/双引号;整行 `#` 注释与空行忽略。

- [ ] **Step 1: 写失败测试**

创建 `skill/scripts/rule-card-yaml.test.mjs`:

```js
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test skill/scripts/rule-card-yaml.test.mjs`
Expected: FAIL,报错 `Cannot find module ...rule-card-yaml.mjs`

- [ ] **Step 3: 实现解析器**

创建 `skill/scripts/lib/rule-card-yaml.mjs`:

```js
// 规则卡受控 YAML 的最小解析器(设计文档 docs/superpowers/specs/2026-09-29-m2-learning-loop-design.md §4.1/§6)
// 只支持约定结构:顶层 id/applies_to/rules 列表、规则字段、scope(match_label/match_selector)。
// 解析不抛异常,全部失败走 errors[{line,message}]——调用方必须先检查 errors 再用 card。

export function parseRuleCard(text) {
  const errors = [];
  const card = { id: '', applies_to: '', rules: [] };
  let curRule = null;
  let inScope = false;

  const stripQuotes = (s) => {
    const t = s.trim();
    if (t.length >= 2 && ((t[0] === '"' && t.at(-1) === '"') || (t[0] === "'" && t.at(-1) === "'"))) {
      return t.slice(1, -1);
    }
    return t;
  };

  const parseValue = (raw, lineNo) => {
    const t = raw.trim();
    if (t === '') return { scalar: '' };
    if (t.startsWith('[')) {
      if (!t.endsWith(']')) {
        errors.push({ line: lineNo, message: `数组未闭合: ${t}` });
        return { array: [] };
      }
      const inner = t.slice(1, -1).trim();
      // 受控约定:数组元素不得含逗号(带逗号的值须换表达方式),split 即安全
      return { array: inner ? inner.split(',').map(stripQuotes) : [] };
    }
    if (t.includes(': ') && !t.startsWith('"') && !t.startsWith("'")) {
      errors.push({ line: lineNo, message: `值含歧义冒号,请加引号: ${t}` });
      return { scalar: '' };
    }
    return { scalar: stripQuotes(t) };
  };

  const KEY_RE = /^(?:-\s+)?([A-Za-z][\w-]*):\s*(.*)$/;

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i].replace(/\t/g, '  ');
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();
    const isItem = trimmed.startsWith('- ');
    const m = trimmed.match(KEY_RE);
    if (!m) {
      errors.push({ line: lineNo, message: `无法解析的行: ${trimmed}` });
      continue;
    }
    const [, key, rest] = m;

    // 缩进 0:顶层键
    if (indent === 0 && !isItem) {
      inScope = false;
      if (key === 'rules') continue;
      if (key === 'id' || key === 'applies_to') {
        card[key] = parseValue(rest, lineNo).scalar ?? '';
      } else {
        errors.push({ line: lineNo, message: `未知顶层键: ${key}` });
      }
      continue;
    }

    // 缩进 2:新列表项(规则)
    if (isItem) {
      if (indent !== 2) {
        errors.push({ line: lineNo, message: `列表项缩进须为 2 空格,实际 ${indent}` });
        continue;
      }
      curRule = {};
      card.rules.push(curRule);
      inScope = false;
      if (rest !== '') {
        const v = parseValue(rest, lineNo);
        if (v.scalar !== undefined) curRule[key] = v.scalar;
        else errors.push({ line: lineNo, message: `列表项首行不支持数组值: ${key}` });
      }
      continue;
    }

    // 缩进 4:规则字段(scope: 开启嵌套块)
    if (indent === 4 && curRule) {
      inScope = false;
      if (key === 'scope') {
        if (rest !== '') {
          errors.push({ line: lineNo, message: 'scope 须为嵌套块(match_label/match_selector),不支持行内值' });
        } else {
          curRule.scope = {};
          inScope = true;
        }
      } else {
        const v = parseValue(rest, lineNo);
        if (v.array !== undefined) curRule[key] = v.array;
        else curRule[key] = v.scalar;
      }
      continue;
    }

    // 缩进 6:scope 字段
    if (indent === 6 && curRule && inScope) {
      if (key === 'match_label' || key === 'match_selector') {
        const v = parseValue(rest, lineNo);
        if (v.array !== undefined) curRule.scope[key] = v.array;
        else errors.push({ line: lineNo, message: `${key} 须为 flow 数组` });
      } else {
        errors.push({ line: lineNo, message: `scope 下未知键: ${key}` });
      }
      continue;
    }

    errors.push({ line: lineNo, message: `缩进 ${indent} 不符合约定(0/2/4/6)` });
  }
  return { card, errors };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test skill/scripts/rule-card-yaml.test.mjs`
Expected: 全部 PASS(8 个测试)

- [ ] **Step 5: Commit**

```bash
git add skill/scripts/lib/rule-card-yaml.mjs skill/scripts/rule-card-yaml.test.mjs
git commit -m "feat(skill): 规则卡受控 YAML 最小解析器 parseRuleCard(零依赖,错误带行号)"
```

---

### Task 2: 卡语义校验 `validateCard`

**Files:**
- Modify: `skill/scripts/validate-rules.mjs`(新建;本任务先放纯函数,Task 4 加 CLI 壳)
- Test: `skill/scripts/validate-rules.test.mjs`(新建)

**Interfaces:**
- Consumes: Task 1 的 `parseRuleCard(text)`(本任务不改它,只引用)
- Produces: `validateCard(card: Object, builtinIds: Set<string>) → Array<{ line?: number, message: string }>`——校验规则:卡 `id` 必填且匹配 kebab-case `/^[a-z0-9]+(-[a-z0-9]+)*$/` 且不在 `builtinIds` 中;`applies_to` 必填且 ∈ 12 枚举;`rules` 非空数组;每条规则 `id`/`title` 必填、规则 `id` 卡内唯一、`priority`(若给)∈ P0–P3、`scope`(若给)须含 `match_label` 或 `match_selector` 至少一个且都为字符串数组。同时导出枚举常量 `INTERACTION_TYPES`(供 Task 3/4 复用)。

- [ ] **Step 1: 写失败测试**

创建 `skill/scripts/validate-rules.test.mjs`:

```js
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test skill/scripts/validate-rules.test.mjs`
Expected: FAIL,报错 `Cannot find module ...validate-rules.mjs`

- [ ] **Step 3: 实现 `validateCard`**

创建 `skill/scripts/validate-rules.mjs`:

```js
// 规则卡校验与缺口台账(设计文档 docs/superpowers/specs/2026-09-29-m2-learning-loop-design.md §4/§6)
// Task 4 将在文件末尾追加 CLI 壳;本文件先只含纯函数与常量。
import { parseRuleCard } from './lib/rule-card-yaml.mjs';

// 与 extension/lib/constants.ts 逐字一致(skill 不 import 插件代码,此处复制是契约同步点,
// validate-rules.test.mjs 有逐字断言防止两处漂移)
export const INTERACTION_TYPES = Object.freeze([
  'text_input', 'textarea', 'select', 'radio', 'checkbox',
  'button', 'link', 'file_upload', 'date_picker', 'pagination',
  'dialog', 'tabs',
]);

const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PRIORITIES = new Set(['P0', 'P1', 'P2', 'P3']);

// 卡级语义校验;返回 [{line?, message}](无行号 = 卡级问题)
export function validateCard(card, builtinIds) {
  const errs = [];
  if (!card.id) errs.push({ message: '卡缺 id' });
  else if (!KEBAB_RE.test(card.id)) errs.push({ message: `卡 id 非 kebab-case: ${card.id}` });
  else if (builtinIds.has(card.id)) errs.push({ message: `卡 id 与内置卡冲突: ${card.id}` });

  if (!card.applies_to) errs.push({ message: '卡缺 applies_to' });
  else if (!INTERACTION_TYPES.includes(card.applies_to)) {
    errs.push({ message: `applies_to 不是合法 interaction_type: ${card.applies_to}` });
  }

  if (!Array.isArray(card.rules) || card.rules.length === 0) {
    errs.push({ message: 'rules 须为非空数组' });
    return errs;
  }

  const seen = new Set();
  card.rules.forEach((rule, i) => {
    const pos = rule.id ? `「${rule.id}」` : `规则 ${i + 1}`;
    if (!rule.id) errs.push({ message: `${pos} 缺 id` });
    else if (seen.has(rule.id)) errs.push({ message: `规则 id 重复: ${rule.id}` });
    else seen.add(rule.id);
    if (!rule.title) errs.push({ message: `${pos} 缺 title` });
    if (rule.priority !== undefined && !PRIORITIES.has(rule.priority)) {
      errs.push({ message: `${pos} priority 非法(须 P0–P3): ${rule.priority}` });
    }
    if (rule.scope !== undefined) {
      const s = rule.scope ?? {};
      const keys = ['match_label', 'match_selector'];
      const hasAny = keys.some((k) => Array.isArray(s[k]));
      if (!hasAny) {
        errs.push({ message: `${pos} scope 须含 match_label 或 match_selector(flow 字符串数组)` });
      } else {
        for (const k of keys) {
          if (s[k] !== undefined && !Array.isArray(s[k])) {
            errs.push({ message: `${pos} scope.${k} 须为 flow 字符串数组` });
          } else if (Array.isArray(s[k]) && s[k].some((v) => typeof v !== 'string')) {
            errs.push({ message: `${pos} scope.${k} 含非字符串元素` });
          }
        }
      }
    }
  });
  return errs;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test skill/scripts/validate-rules.test.mjs`
Expected: 全部 PASS(11 个测试)

- [ ] **Step 5: Commit**

```bash
git add skill/scripts/validate-rules.mjs skill/scripts/validate-rules.test.mjs
git commit -m "feat(skill): 规则卡语义校验 validateCard(枚举/kebab-case/内置冲突/id 唯一/scope 结构)"
```

---

### Task 3: 缺口台账纯函数 `mergeGaps` / `resolveGaps`

**Files:**
- Modify: `skill/scripts/validate-rules.mjs`(追加两个导出函数与常量)
- Test: `skill/scripts/validate-rules.test.mjs`(追加测试)

**Interfaces:**
- Consumes: 无新依赖(纯数据函数)
- Produces:
  - `THIN_THRESHOLD = 3`(卡内规则数 < 3 为 thin)
  - `mergeGaps(existing: Gap[], incoming: Gap[], sessionId: string) → Gap[]`:合并键 `interaction_type + gap_type`;同键 → `sessions` 去重追加 `sessionId`、`detail`/`suggestion` 用 incoming 覆盖、`first_seen` 保留;新键 → 追加 `{...gap, first_seen: sessionId, sessions: [sessionId]}`。**不修改入参**(返回新数组)。
  - `resolveGaps(gaps: Gap[], counts: Map<interaction_type, number>) → Gap[]`:移除 `gap_type === 'missing'` 且 `counts.get(type) > 0` 的项;移除 `gap_type === 'thin'` 且 `counts.get(type) >= THIN_THRESHOLD` 的项;其余保留。
  - Gap 形状:`{ interaction_type, gap_type: 'missing'|'thin', detail, suggestion, first_seen, sessions: string[] }`

- [ ] **Step 1: 追加失败测试**

在 `skill/scripts/validate-rules.test.mjs` 末尾追加:

```js
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
```

- [ ] **Step 2: 运行测试确认新测试失败**

Run: `node --test skill/scripts/validate-rules.test.mjs`
Expected: 新增测试 FAIL(`mergeGaps` 等未导出);Task 2 的既有测试仍 PASS

- [ ] **Step 3: 实现(追加到 validate-rules.mjs 的 validateCard 之后)**

```js
// ---- 缺口台账纯函数(spec §4.3)----

export const THIN_THRESHOLD = 3; // 卡内规则数 < 3 = thin(spec §4.2)

// 合并本次 rule_gaps 进台账:键 interaction_type+gap_type;
// 同键 → sessions 去重追加、detail/suggestion 覆盖、first_seen 保留;新键 → 追加。
// 纯函数,不修改入参。
export function mergeGaps(existing, incoming, sessionId) {
  const out = existing.map((g) => ({ ...g, sessions: [...(g.sessions ?? [])] }));
  for (const inc of incoming) {
    const hit = out.find(
      (g) => g.interaction_type === inc.interaction_type && g.gap_type === inc.gap_type
    );
    if (hit) {
      hit.detail = inc.detail;
      hit.suggestion = inc.suggestion;
      if (!hit.sessions.includes(sessionId)) hit.sessions.push(sessionId);
    } else {
      out.push({ ...inc, first_seen: sessionId, sessions: [sessionId] });
    }
  }
  return out;
}

// 按当前卡况(内置+项目合并后的 interaction_type → 规则数)清理台账:
// missing 且已有卡 → 移除;thin 且规则数 ≥ 阈值 → 移除;其余保留。纯函数。
export function resolveGaps(gaps, counts) {
  return gaps.filter((g) => {
    const n = counts.get(g.interaction_type) ?? 0;
    if (g.gap_type === 'missing') return n === 0;
    return g.gap_type === 'thin' ? n < THIN_THRESHOLD : true;
  });
}
```

- [ ] **Step 4: 运行测试确认全部通过**

Run: `node --test skill/scripts/validate-rules.test.mjs`
Expected: 全部 PASS(19 个测试)

- [ ] **Step 5: Commit**

```bash
git add skill/scripts/validate-rules.mjs skill/scripts/validate-rules.test.mjs
git commit -m "feat(skill): 缺口台账纯函数 mergeGaps/resolveGaps(同键合并、补齐即移除)"
```

---

### Task 4: CLI 壳 `runValidate` / `runGaps` 与命令入口

**Files:**
- Modify: `skill/scripts/validate-rules.mjs`(文件末尾追加 CLI 层)
- Test: `skill/scripts/validate-rules.test.mjs`(追加集成测试,用临时目录)

**Interfaces:**
- Consumes: Task 1 `parseRuleCard`、Task 2 `validateCard`/`INTERACTION_TYPES`、Task 3 `mergeGaps`/`resolveGaps`
- Produces(全部导出,测试直接调用,不经子进程):
  - `loadBuiltinCardIds(builtinDir: string) → Set<string>`:读目录下 `*.yaml`,解析后取 `card.id`(解析失败的卡跳过并忽略——内置卡损坏不是用户可修复问题,但 validate 运行中若全部解析失败会自然导致冲突检查失效,风险可接受)
  - `runValidate(rulesDir: string, builtinDir: string) → { ok: boolean, report: string }`:遍历 `rulesDir/*.yaml` 与 `rulesDir/drafts/*.yaml`(目录不存在按空处理),逐卡 parse + validate;正式区卡 id 重复 = 错误,草稿与正式卡同 id = 告警(不算失败);全通过 `ok: true`,`report` 含 `✓ N 张卡校验通过`,否则逐条列出 `文件:行号: 信息`,`ok: false`
  - `runGaps(workspaceDir: string, opts: { from?: string }) → { ok: boolean, report: string, remaining: number }`:读 `workspaceDir/rules/gaps.json`(不存在 → 以空台账新建;损坏 → `ok: false` 且不写回);`opts.from` 给定时读该 cases.json 的 `rule_gaps` 与 `meta.session_id` 做合并;规则卡计数 = 内置目录 + `workspaceDir/rules/*.yaml` 按 `applies_to` 合并;`resolveGaps` 清理;台账有变化(或新建)则写回;`report` 列剩余缺口,`remaining` 为剩余条数
  - 命令行(CLI 模式自判定):`node <skill>/scripts/validate-rules.mjs validate [rulesDir] [builtinDir]` 与 `node <skill>/scripts/validate-rules.mjs gaps [workspaceDir] [--from <cases.json>]`;默认 `rulesDir = workspace/rules`、`builtinDir = <脚本相对路径>/../references/rules`、`workspaceDir = workspace`;退出码 0/1

- [ ] **Step 1: 追加失败测试**

在 `skill/scripts/validate-rules.test.mjs` 末尾追加:

```js
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
  const r = runGaps(root, { from: join(root, 'cases.json') });
  assert.equal(r.ok, true);
  assert.equal(r.remaining, 1);
  const saved = JSON.parse(readFileSync(join(root, 'rules/gaps.json'), 'utf8'));
  assert.equal(saved.gaps.length, 1);
  assert.equal(saved.gaps[0].interaction_type, 'tabs');
  assert.deepEqual(saved.gaps[0].sessions, ['s1']);
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
```

同时创建内置卡 fixture 目录(避免测试依赖真实 `references/rules`,保持单测自包含):

创建 `skill/scripts/fixtures-builtin/button-standard.yaml`:

```yaml
id: button-standard
applies_to: button
rules:
  - id: click-response
    title: 点击响应
```

- [ ] **Step 2: 运行测试确认新测试失败**

Run: `node --test skill/scripts/validate-rules.test.mjs`
Expected: 新增 5 个测试 FAIL(`runValidate`/`runGaps` 未导出);既有 19 个仍 PASS

- [ ] **Step 3: 实现 CLI 层(追加到 validate-rules.mjs 末尾)**

```js
// ---- 文件层与 CLI(spec §6)----
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const BUILTIN_DIR_DEFAULT = join(dirname(fileURLToPath(import.meta.url)), '..', 'references', 'rules');

// 读目录下全部 *.yaml 的卡 id(解析失败的卡跳过)
export function loadBuiltinCardIds(builtinDir) {
  const ids = new Set();
  if (!existsSync(builtinDir)) return ids;
  for (const f of readdirSync(builtinDir).filter((f) => f.endsWith('.yaml'))) {
    const { card, errors } = parseRuleCard(readFileSync(join(builtinDir, f), 'utf8'));
    if (errors.length === 0 && card.id) ids.add(card.id);
  }
  return ids;
}

// 读单张卡文件 → { file, card, errors }
function loadCardFile(path) {
  const { card, errors } = parseRuleCard(readFileSync(path, 'utf8'));
  return { file: path, card, errors };
}

// validate 子命令:校验 rulesDir 正式区 + drafts/ 草稿区
export function runValidate(rulesDir, builtinDir = BUILTIN_DIR_DEFAULT) {
  const report = [];
  let ok = true;
  const builtinIds = loadBuiltinCardIds(builtinDir);
  const seenIds = new Map(); // 卡 id → 文件(正式区)
  const draftIds = new Map();

  const zones = [
    { dir: rulesDir, label: '', dupMap: seenIds },
    { dir: join(rulesDir, 'drafts'), label: 'drafts/', dupMap: draftIds },
  ];
  let checked = 0;
  for (const zone of zones) {
    if (!existsSync(zone.dir)) continue;
    for (const f of readdirSync(zone.dir).filter((f) => f.endsWith('.yaml')).sort()) {
      const path = join(zone.dir, f);
      const { card, errors } = loadCardFile(path);
      checked++;
      for (const e of errors) {
        ok = false;
        report.push(`${zone.label}${f}:${e.line}: ${e.message}`);
      }
      for (const e of validateCard(card, builtinIds)) {
        ok = false;
        report.push(`${zone.label}${f}:${e.line ?? 1}: ${e.message}`);
      }
      if (card.id) {
        if (zone.dupMap.has(card.id)) {
          ok = false;
          report.push(`${zone.label}${f}:1: 卡 id 重复: ${card.id}(另见 ${zone.dupMap.get(card.id)})`);
        } else {
          zone.dupMap.set(card.id, `${zone.label}${f}`);
        }
      }
    }
  }
  // 草稿与正式卡同 id = 告警(入库语义是追加/更新,不算失败)
  for (const [id, where] of draftIds) {
    if (seenIds.has(id)) report.push(`告警:${where} 与正式卡 ${seenIds.get(id)} 同 id(入库时将走更新语义)`);
  }
  if (ok) return { ok, report: `✓ ${checked} 张卡校验通过` };
  return { ok, report: report.join('\n') };
}

// gaps 子命令:读台账(+可选 --from 合并本次缺口)→ 按当前卡清理 → 写回
export function runGaps(workspaceDir, { from } = {}) {
  const rulesDir = join(workspaceDir, 'rules');
  const gapsPath = join(rulesDir, 'gaps.json');

  let book = { schema_version: '0.1', gaps: [] };
  let bookExists = existsSync(gapsPath);
  if (bookExists) {
    try {
      book = JSON.parse(readFileSync(gapsPath, 'utf8'));
    } catch (e) {
      return { ok: false, report: `gaps.json 损坏(${e.message}),请人工决定修复或重建——不静默覆盖跨会话台账`, remaining: -1 };
    }
  }

  let gaps = Array.isArray(book.gaps) ? book.gaps : [];
  let sessionId = '';
  if (from) {
    const cases = JSON.parse(readFileSync(from, 'utf8'));
    sessionId = cases.meta?.session_id ?? '';
    gaps = mergeGaps(gaps, cases.rule_gaps ?? [], sessionId);
  }

  // 规则数计数:内置卡 + 项目正式卡(草稿不计),按 applies_to 合并
  const counts = new Map();
  const bump = (dir) => {
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.yaml'))) {
      const { card, errors } = loadCardFile(join(dir, f));
      if (errors.length || !card.applies_to) continue;
      counts.set(card.applies_to, (counts.get(card.applies_to) ?? 0) + (card.rules?.length ?? 0));
    }
  };
  bump(BUILTIN_DIR_DEFAULT);
  bump(rulesDir);

  const remaining = resolveGaps(gaps, counts);
  const changed = !bookExists || remaining.length !== gaps.length ||
    JSON.stringify(remaining) !== JSON.stringify(gaps);
  if (changed) {
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(gapsPath, JSON.stringify({ schema_version: '0.1', gaps: remaining }, null, 2) + '\n', 'utf8');
  }

  const lines = [`缺口台账:${remaining.length} 条未补齐${changed ? '(已写回 gaps.json)' : '(无变化,未写盘)'}`];
  for (const g of remaining) {
    lines.push(`- [${g.gap_type}] ${g.interaction_type}:${g.detail} → ${g.suggestion}(首见 ${g.first_seen},${g.sessions.length} 个会话)`);
  }
  return { ok: true, report: lines.join('\n'), remaining: remaining.length };
}

// ---- CLI 入口 ----
function main() {
  const [, , cmd, arg, ...rest] = process.argv;
  const flag = (name) => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  if (cmd === 'validate') {
    const r = runValidate(resolve(arg ?? 'workspace/rules'), resolve(rest[0] ?? BUILTIN_DIR_DEFAULT));
    console.log(r.report);
    process.exitCode = r.ok ? 0 : 1;
  } else if (cmd === 'gaps') {
    const fromFlag = flag('--from');
    const r = runGaps(resolve(arg ?? 'workspace'), { from: fromFlag ? resolve(fromFlag) : undefined });
    console.log(r.report);
    process.exitCode = r.ok ? 0 : 1;
  } else {
    console.log('用法: validate-rules.mjs validate [rulesDir] [builtinDir] | gaps [workspaceDir] [--from cases.json]');
    process.exitCode = 1;
  }
}

// 直接执行时进 CLI,被 import(测试)时不执行
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
```

注意:测试文件顶部已有的 `import ... from './validate-rules.mjs'` 无需改动(node:test 文件可多次 import 同一模块)。

- [ ] **Step 4: 运行全部 skill 脚本测试确认通过**

Run: `node --test skill/scripts/`
Expected: 全部 PASS(24 个测试,3 个文件)

- [ ] **Step 5: CLI 冒烟(真实内置卡目录)**

Run: `node skill/scripts/validate-rules.mjs validate skill/references/rules`
Expected: 输出 `✓ 12 张卡校验通过`,退出码 0

Run: `node skill/scripts/validate-rules.mjs gaps`
Expected: 输出 `缺口台账:0 条未补齐(已写回 gaps.json)`——**注意**这会在仓库根创建 `workspace/rules/gaps.json`,而 `workspace/` 已被 gitignore,验证后删除:`rm -rf workspace`(或留着供 Task 7 验收,二选一,验收任务会重建)

- [ ] **Step 6: Commit**

```bash
git add skill/scripts/validate-rules.mjs skill/scripts/validate-rules.test.mjs skill/scripts/fixtures-builtin/
git commit -m "feat(skill): validate-rules CLI——validate/gaps 子命令(台账合并+按卡况自动清理)"
```

---

### Task 5: SKILL.md 六步管线改写

**Files:**
- Modify: `skill/SKILL.md`(整文件重写,以下为完整新内容)

**Interfaces:**
- Consumes: Task 4 的 CLI 命令名与行为(文档中引用)
- Produces: 对 AI 会话生效的管线指令(无代码接口;本任务验收为内容核对清单)

- [ ] **Step 1: 用以下完整内容替换 `skill/SKILL.md`**

````markdown
---
name: casefront
description: Web 测试用例 AI 前置助手。读取插件产出的 inventory.json（页面交互清单），结合内置规则卡与项目 rules/*.yaml 生成测试用例（cases.md + cases.json），并把对话中的临时业务规则沉淀为规则卡草稿、维护规则缺口台账。当用户需要"根据页面交互清单生成测试用例"、"扫描结果生成用例"、提供交互清单文件要求生成测试用例、说"跑 casefront 流水线"或 @ inventory.json，或要求"沉淀规则卡 / 查看规则缺口"时使用。
---

# casefront — Web 测试用例 AI 前置助手（Skill 侧）

> 输入：`inventory/＜session＞/inventory.json`（插件产出，schema_version 0.1，契约见 docs/superpowers/specs/2026-09-14-web-test-case-assistant-design.md §4.1）
> 输出：同目录 `cases.md` + `cases.json`（schema_version 0.2）；另沉淀 `rules/drafts/*.yaml` 草稿与 `rules/gaps.json` 缺口台账

## 输入清单

- `inventory.json`：插件产出（契约 §4.1）；`confidence < 0.9` 与 `unclassified` 需走裁决
- `rules/*.yaml`：项目级规则卡（正式区），按 `applies_to` 覆写/追加内置标准卡（§4.5）；
  带 `scope` 的规则只对命中元素生效（见「规则卡格式约定」）
- `rules/drafts/*.yaml`：草稿区——**生成管线不消费草稿**，只消费正式区与内置卡
- `references/rules/*.yaml`：内置 12 张标准卡，覆盖全部 interaction_type（text_input / textarea / select / radio / checkbox / button / link / file_upload / date_picker / pagination / dialog / tabs）
- `rules/gaps.json`：跨会话缺口台账（第 6 步读写）
- `demo/examples.md`：测试者手写用例样例，用于风格对齐（可缺省）
- 对话中的临时业务规则：**对话任何时刻出现都先记录**（本次生成即生效），第 6 步统一沉淀

## 生成管线（六步，演示页走完才能交付）

1. **裁决**：列出全部 `confidence < 0.9` 的 elements 与 `unclassified`，逐条给出你判定的
   interaction_type 与理由；低信心项请用户确认（**收敛点①**）。unclassified 只建议、不自动纳入。
2. **匹配**：读内置卡与 `rules/` 项目卡，按 `applies_to` 挂卡；**带 `scope` 的规则只挂命中元素**
   （match_label 对元素 label 子串包含匹配、match_selector 按选择器匹配，两者同时给取 AND、
   数组内取 OR），未命中元素跳过该规则——命中结果不单独落字段，自然体现在用例的
   rule_refs + element_ids 上。`selected=false` 的元素跳过并记入 `coverage.skipped_reasons`；
   某类型（内置+项目合并视角）无卡 → 记 missing 缺口、卡内规则 < 3 条 → 记 thin 缺口，
   产出结构化 `rule_gaps`（见产出示例）。（1 元素 × N 规则 = N 个检查点，全部携带规则 id）
3. **收敛**：按「共性合并/个性独立」（见下）拟出检查点清单摘要 → 用户确认范围后继续
   （**收敛点②**）。宁少勿滥，范围外不自动加 case。
4. **组装**：检查点 → 用例。**共性规则**（empty-submit / xss 等全表单共性项）同区块合并成
   一条；**个性规则**（选项往返、防重复提交等）一元素一条。priority 取规则卡默认值，
   可按页面上下文整体修正但需在对话中说明。
5. **对齐**：若 `demo/examples.md` 存在，先总结其结构/措辞/粒度习惯，再按其风格写 cases.md；
   cases.json 每条带 `style_source`。
6. **沉淀**（**收敛点③**，交付用例后执行；无临时规则且 rule_gaps 为空 → 跳过）：
   1. 汇总本次对话临时业务规则 + 本次 `rule_gaps`
   2. 临时规则 → 归纳为草稿卡规则条目：推断 applies_to、拟 `scope`（字段级规则必须拟 scope）、
      判定「新建卡 or 追加进已有卡」，生成草稿 YAML → 写 `rules/drafts/`；
      同 id 草稿已存在 → 先合并展示差异再覆写
   3. 展示草稿全文 + 处置建议（新建 / 追加 / 更新覆写 xx 卡的 yy 规则）→ 等用户确认；
      被拒绝 → 保留草稿或按用户意见修改，不强行入库
   4. 确认后：写 `rules/` 正式区（新建卡 / 追加规则 / 同规则 id 覆写），删除已入库草稿文件
   5. 合并台账：本次缺口按 `interaction_type + gap_type` 合并进 `rules/gaps.json`
      （同键追加 sessions、更新 detail/suggestion；同会话不重复），并按当前卡况清理已补齐缺口
   6. 校验：环境有 Node → 依次运行
      `node <skill>/scripts/validate-rules.mjs validate <workspace>/rules` 与
      `node <skill>/scripts/validate-rules.mjs gaps <workspace> --from <session>/cases.json`
      （后者完成第 5 小步的台账合并+清理，AI 不重复手动操作）；无 Node → 按下方自查清单自查

## 追溯与纪律

- 每条用例必须携带 `rule_refs`（`卡id:规则id`）与 `element_ids`；缺任何一项不得输出。
- **scope 纪律**：带 scope 的规则必须能在 inventory 中指出命中的元素，指不出不得入库
  （防"幽灵规则"污染后续生成）。
- cases.json 结构（契约 §4.4，schema_version 0.2）：schema_version / meta / cases[] / coverage /
  rule_gaps（结构化对象数组，无缺口时为 []，见产出示例）。
- **规则缺口清单**：结构化 rule_gaps 附在报告末尾成表，并经第 6 步进台账——规则卡体系
  自我生长的入口，测得越多卡越厚。
- **临时规则沉淀**：对话中的特殊业务规则（如"手机号必须11位"）除本次生效外，第 6 步归纳为
  草稿卡，经用户确认后入 `rules/`——对话知识沉淀为团队资产。

## 规则卡 YAML 格式约定（供脚本解析器，必须遵守）

- 缩进：顶层 0 空格、列表项 2 空格（`- id: …`）、规则字段 4 空格、scope 字段 6 空格
- 字符串可省引号；**值中含 `: `（冒号+空格）必须整体加引号**
- 数组一律 flow 格式 `["a", "b"]`；数组元素不得含逗号
- 禁用多行块（`|`、`>`）与锚点/引用
- 无 Node 环境时的自查清单：applies_to ∈ 12 枚举、规则 id 卡内唯一、卡 id kebab-case 且
  不与内置卡 id 冲突、scope 只含 match_label / match_selector 且均为字符串数组

### 项目卡示例

```yaml
id: text-input-project
applies_to: text_input
rules:
  - id: asset-code-uppercase
    title: 资产编号大写开头
    detail: 资产编号字段输入小写开头的编号，提交应被拦截
    priority: P1
    scope:
      match_label: ["资产编号", "编号"]
```

## 产出示例（字段级样例，禁止原样拷贝进产物）

```json
{
  "schema_version": "0.2",
  "meta": { "session_id": "…" },
  "cases": [{
    "id": "c001", "title": "注册提交-空表单校验", "priority": "P0",
    "preconditions": ["已打开注册页"],
    "steps": ["不填写任何字段，直接点击注册"],
    "expected": ["必填字段下方提示错误，不发起提交请求"],
    "rule_refs": ["text-input-standard:empty-submit"],
    "element_ids": ["e001"], "style_source": null
  }],
  "coverage": { "elements_total": 6, "covered": 6, "skipped_reasons": {} },
  "rule_gaps": [{
    "interaction_type": "date_picker",
    "gap_type": "thin",
    "detail": "date_picker 卡仅 2 条规则，缺跨月与时间维度",
    "suggestion": "建议补 month-boundary、time-format 规则"
  }]
}
```
````

- [ ] **Step 2: 内容核对(逐项检查)**

Run: 人工核对替换后的 `skill/SKILL.md`
Expected 核对清单:
- [ ] frontmatter `name: casefront` 与 `description` 含「沉淀规则卡 / 查看规则缺口」触发语
- [ ] 六步齐全,收敛点①②③各出现一次且位置正确
- [ ] 第 2 步含 scope 匹配语义(AND/OR)与 missing/thin 判定(合并视角)
- [ ] 第 6 步含空转保护、草稿合并展示、确认语义、台账合并、双路校验
- [ ] 「生成管线不消费草稿」出现在输入清单
- [ ] scope 纪律条款在「追溯与纪律」
- [ ] 产出示例 schema_version 0.2、rule_gaps 为对象数组
- [ ] YAML 格式约定 5 条齐全 + 项目卡示例含 scope
- [ ] CLI 命令与 Task 4 实现一致(`validate [rulesDir]`、`gaps [workspaceDir] --from`)

- [ ] **Step 3: Commit**

```bash
git add skill/SKILL.md
git commit -m "feat(skill): SKILL.md 六步管线——第 6 步沉淀(草稿入库/台账合并/scope 纪律),契约 0.2"
```

---

### Task 6: 契约标注收尾(build-cases.mjs 0.2 + README 里程碑)

**Files:**
- Modify: `extension/scripts/build-cases.mjs:60`
- Modify: `README.md`(状态区 + 文档链接区)

**Interfaces:**
- Consumes: 无
- Produces: build-cases.mjs 产出标注为 0.2;README 反映 M2 完成

- [ ] **Step 1: 修改 build-cases.mjs 的 schema_version**

`extension/scripts/build-cases.mjs` 第 60 行:

```js
// 改前
  schema_version: '0.1',
// 改后
  schema_version: '0.2',
```

(其 `rule_gaps` 字段本就是对象数组 `{gap, suggestion}`,与 0.2 契约方向一致;此脚本为自扫描辅助工具不在 skill 契约测试范围,标注修正即可。)

- [ ] **Step 2: 更新 README**

`README.md` 文档链接区(「## 文档」列表末尾)追加:

```markdown
- [M2 学习闭环设计](docs/superpowers/specs/2026-09-29-m2-learning-loop-design.md)
```

`README.md` 状态区,把:

```markdown
- [ ] M2 学习闭环：临时业务规则 → 规则卡草稿、规则缺口报告
```

改为:

```markdown
- [x] M2 学习闭环：临时规则→草稿卡（rules/drafts/）→确认入库；结构化规则缺口 + gaps.json 跨会话台账；
      规则卡 scope 字段（字段级规则作用域）；validate-rules.mjs 校验脚本（零依赖）
```

- [ ] **Step 3: 验证插件测试不受影响**

Run: `cd extension && npm test`
Expected: 全部 PASS(纯逻辑 27 + 组件 4;插件代码零改动,仅其 scripts/ 下一个字段)

- [ ] **Step 4: Commit**

```bash
git add extension/scripts/build-cases.mjs README.md
git commit -m "chore: 契约标注 0.2(build-cases)与 README M2 里程碑勾选"
```

---

### Task 7: 手动验收——testpage 两轮生成对照

**Files:**
- 产物(均不入库,`workspace/` 已 gitignore):`workspace/inventory/<session>/`、`workspace/rules/`

**Interfaces:**
- Consumes: Task 1–6 全部产物;`extension/scripts/scan-testpage.mjs`(已有,用法 `cd extension && node scripts/scan-testpage.mjs <url> [outdir]`,前置 testpage dev server)
- Produces: 验收记录(对话中呈现),对照设计文档 §8.3 表格

- [ ] **Step 1: 启动 testpage 并扫描(第一轮)**

```bash
cd testpage && npm run dev   # 端口 5175,后台运行
cd extension && node scripts/scan-testpage.mjs http://localhost:5175/form ../workspace/inventory/m2-accept-round1
```

Expected: `workspace/inventory/m2-accept-round1/inventory.json` 生成,含 form 页全部交互元素

- [ ] **Step 2: 第一轮生成(走六步管线)**

在 AI 会话中按 SKILL.md 对 round1 的 inventory.json 执行管线,并在对话中主动给一条
**字段级临时规则**(如「资产编号必须大写字母开头」)+ 确认一条真实缺口(如某类型卡偏薄)。
Expected:
- 产出 cases.md + cases.json(`schema_version: "0.2"`,`rule_gaps` 为对象数组)
- `workspace/rules/drafts/` 出现带 `scope` 的草稿卡
- 展示草稿 + 处置建议后等待确认(收敛点③)

- [ ] **Step 3: 确认入库并校验**

确认草稿入库,然后:

```bash
node skill/scripts/validate-rules.mjs validate workspace/rules
node skill/scripts/validate-rules.mjs gaps workspace --from workspace/inventory/m2-accept-round1/cases.json
```

Expected: validate `✓ N 张卡校验通过`(含新正式卡);gaps 台账建立且剩余缺口列表正确;
`workspace/rules/drafts/` 已清空

- [ ] **Step 4: 第二轮生成(同页重扫)**

```bash
cd extension && node scripts/scan-testpage.mjs http://localhost:5175/form ../workspace/inventory/m2-accept-round2
```

按 SKILL.md 对 round2 执行管线(不再给临时规则)。
Expected:
- 第一轮入库的字段级规则产出**新用例**,rule_refs 指向 `*-project` 卡且 element_ids 命中对应元素
- `rule_gaps` 不再含第一轮已补齐的缺口(或缺口 detail 更新)
- 与第一轮 cases 对比,用例集可感知变厚(新增字段级用例可指出)

- [ ] **Step 5: 验收结论与收尾**

对照设计文档 §8.3 三行验收表逐项打勾;任一项不满足 → 回到对应任务修复后重跑本任务。
通过后:

```bash
git status --short   # 确认工作区干净(验收产物全在 gitignore 的 workspace/ 下)
```

Expected: 无未跟踪的仓库文件;M2 完成,在对话中输出验收摘要

---
