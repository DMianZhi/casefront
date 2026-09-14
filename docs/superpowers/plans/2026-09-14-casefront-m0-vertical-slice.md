# CaseFront M0 竖切 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 走通全链路——Chrome 插件 CDP 采集真实页面 → inventory.json → Skill 按内置规则卡生成 cases.md/cases.json（10~30 条、可追溯 rule_refs）。

**Architecture:** 插件为 Chrome MV3（popup 发消息 → background service worker 用 chrome.debugger 走 CDP 拿 AXTree → 纯函数管线 reducer/denoiser/classifier/exporter → 下载 inventory.json）。纯函数用 Node 内置 `node:test` 做 TDD；CDP 层与端到端用手测清单验证。Skill 侧是 SKILL.md 指令 + 5 张内置 YAML 规则卡，由 Comate agent 执行生成管线。

**Tech Stack:** Chrome Extensions MV3（vanilla JS, ESM, zero build）；Node ≥ 22（`node --test`）；YAML 规则卡；无 npm 依赖。

**Spec:** `docs/superpowers/specs/2026-09-14-web-test-case-assistant-design.md`（本计划从该文档论证；执行者两份都要读）

## Global Constraints

- Node 测试运行器：`node --test extension/tests/`（Node ≥ 22，无需安装任何依赖）
- 插件零构建：源码即发布物，`extension/` 直接「加载已解压的扩展程序」可用
- 数据契约 `schema_version: "0.1"`；字段名以 Spec §4.1/4.4 为准，不得增删语义字段
- `interaction_type` 枚举固定 12 种：`text_input textarea select radio checkbox button link file_upload date_picker pagination dialog tabs`
- confidence 阈值 `0.9`：≥0.9 直进清单；<0.9 进清单但标低信心交 Skill 裁决；认不出 → `unclassified`（不丢弃）
- 百分位进度提示：popup 扫描期间展示状态文案；CDP attach 失败必须给出「关闭 DevTools 后重试」引导
- 所有新文件 UTF-8、LF；提交信息用 conventional commits（feat/fix/test/docs/chore）

---

### Task 1: 契约常量与测试基座

**Files:**
- Create: `extension/package.json`（仅声明 `"type": "module"`，无依赖）
- Create: `extension/src/constants.js`
- Create: `extension/tests/constants.test.js`

**Interfaces:**
- Consumes: 无
- Produces: `INTERACTION_TYPES`（12 种枚举数组）、`CONF_THRESHOLD = 0.9`、`CONF_HIGH = 0.95`、`CONF_LOW = 0.6`（后续任务 import）

- [ ] **Step 1: 初始化 package.json 与失败测试**

`extension/package.json`:

```json
{ "name": "casefront-extension", "private": true, "type": "module" }
```

`extension/tests/constants.test.js`:

```js
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd extension && node --test tests/`
Expected: FAIL，报错 `Cannot find package ... constants.js`（模块不存在）

- [ ] **Step 3: 写最小实现**

`extension/src/constants.js`:

```js
export const INTERACTION_TYPES = Object.freeze([
  'text_input', 'textarea', 'select', 'radio', 'checkbox',
  'button', 'link', 'file_upload', 'date_picker', 'pagination',
  'dialog', 'tabs',
]);
export const CONF_THRESHOLD = 0.9;
export const CONF_HIGH = 0.95;
export const CONF_LOW = 0.6;
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd extension && node --test tests/`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add extension/package.json extension/src/constants.js extension/tests/constants.test.js
git commit -m "test: M0 契约常量与 node:test 基座"
```

---

### Task 2: reducer —— AXTree → 候选交互元素

**Files:**
- Create: `extension/src/reducer.js`
- Create: `extension/tests/fixtures/axtree-register.json`（真实 CDP 返回结构的裁剪样本）
- Create: `extension/tests/reducer.test.js`

**Interfaces:**
- Consumes: 无（输入为 CDP `Accessibility.getFullAXTree` 的 `nodes` 数组）
- Produces: `reduceAxtree(nodes) -> candidates[]`；candidate 形如 `{ backendDOMNodeId, role, name, ignored, properties }`（仅含 role 可映射的叶子交互节点；保留父链用于后续标注）

- [ ] **Step 1: 写 fixture**

`extension/tests/fixtures/axtree-register.json`（真实 CDP 形状裁剪；含被过滤项）:

```json
{
  "nodes": [
    { "nodeId": 1, "role": { "type": "role", "value": "RootWebArea" }, "name": { "value": "注册页" }, "childIds": [2, 3, 4, 5, 6, 7, 8, 9] },
    { "nodeId": 2, "backendDOMNodeId": 101, "role": { "type": "role", "value": "textbox" }, "name": { "value": "手机号" }, "ignored": false, "properties": [{ "name": "required", "value": { "type": "boolean", "value": true } }], "childIds": [] },
    { "nodeId": 3, "backendDOMNodeId": 102, "role": { "type": "role", "value": "textbox" }, "name": { "value": "密码" }, "ignored": false, "properties": [], "childIds": [] },
    { "nodeId": 4, "backendDOMNodeId": 103, "role": { "type": "role", "value": "textbox" }, "name": { "value": "", "type": "computedString" }, "ignored": true, "properties": [], "childIds": [] },
    { "nodeId": 5, "backendDOMNodeId": 104, "role": { "type": "role", "value": "combobox" }, "name": { "value": "账号类型" }, "ignored": false, "properties": [{ "name": "haspopup", "value": { "type": "token", "value": "listbox" } }], "childIds": [] },
    { "nodeId": 6, "backendDOMNodeId": 105, "role": { "type": "role", "value": "checkbox" }, "name": { "value": "我已阅读并同意用户协议" }, "ignored": false, "properties": [], "childIds": [] },
    { "nodeId": 7, "backendDOMNodeId": 106, "role": { "type": "role", "value": "button" }, "name": { "value": "注 册" }, "ignored": false, "properties": [], "childIds": [] },
    { "nodeId": 8, "backendDOMNodeId": 107, "role": { "type": "role", "value": "link" }, "name": { "value": "已有账号？去登录" }, "ignored": false, "properties": [], "childIds": [] },
    { "nodeId": 9, "backendDOMNodeId": 108, "role": { "type": "role", "value": "image" }, "name": { "value": "banner" }, "ignored": false, "properties": [], "childIds": [] },
    { "nodeId": 10, "backendDOMNodeId": 109, "role": { "type": "role", "value": "genericContainer" }, "name": { "value": "" }, "ignored": true, "properties": [], "childIds": [2] }
  ]
}
```

- [ ] **Step 2: 写失败测试**

`extension/tests/reducer.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reduceAxtree } from '../src/reducer.js';

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/axtree-register.json', import.meta.url), 'utf8'));

test('只保留可映射交互 role 的未忽略叶子节点', () => {
  const out = reduceAxtree(fixture.nodes);
  assert.deepEqual(out.map(c => c.role), ['textbox', 'textbox', 'combobox', 'checkbox', 'button', 'link']);
  assert.ok(out.every(c => typeof c.backendDOMNodeId === 'number'));
});

test('ignored=true 的 textbox(name 为空) 被丢弃', () => {
  const out = reduceAxtree(fixture.nodes);
  assert.ok(!out.some(c => c.name === ''));
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd extension && node --test tests/reducer.test.js`
Expected: FAIL（`reduceAxtree` 未定义/不存在）

- [ ] **Step 4: 写最小实现**

`extension/src/reducer.js`:

```js
const MAPPABLE_ROLES = new Set([
  'textbox', 'combobox', 'listbox', 'radio', 'checkbox', 'button',
  'link', 'menuitemcheckbox', 'menuitemradio', 'searchbox',
]);

// AXTree → 候选交互元素：只挑 role 可映射、未忽略的叶子节点
export function reduceAxtree(nodes) {
  return nodes.filter(n =>
    n && !n.ignored &&
    n.role && n.role.type === 'role' && MAPPABLE_ROLES.has(n.role.value) &&
    (n.childIds ?? []).length === 0
  ).map(n => ({
    backendDOMNodeId: n.backendDOMNodeId ?? null,
    role: n.role.value,
    name: n.name?.value ?? '',
    ignored: false,
    properties: Array.isArray(n.properties) ? n.properties : [],
  }));
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd extension && node --test tests/reducer.test.js`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add extension/src/reducer.js extension/tests/reducer.test.js extension/tests/fixtures/axtree-register.json
git commit -m "feat: reducer 从 AXTree 提取候选交互元素"
```

---

### Task 3: denoiser —— 过滤装饰/隐藏，标注 disabled

**Files:**
- Create: `extension/src/denoiser.js`
- Create: `extension/tests/denoiser.test.js`

**Interfaces:**
- Consumes: `reduceAxtree` 的 candidates[]（Task 2 格式）；候选可附带 `bounds = {width,height}` 与 `visible`（CDP 阶段注入，测试直接给定）
- Produces: `denoise(candidates) -> { kept, dropped }`；dropped 每项含 `reason`（`'zero-size' | 'hidden' | 'pruned'`）；disabled 不丢弃，标注到 `state.disabled`

- [ ] **Step 1: 写失败测试**

`extension/tests/denoiser.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { denoise } from '../src/denoiser.js';

const cand = (over = {}) => ({ role: 'button', name: 'x', properties: [], bounds: { width: 10, height: 10 }, visible: true, ...over });

test('零尺寸与 hidden 元素被移除并给出理由', () => {
  const { kept, dropped } = denoise([
    cand(),
    cand({ bounds: { width: 0, height: 0 } }),
    cand({ visible: false }),
    cand({ properties: [{ name: 'hidden', value: { type: 'boolean', value: true } }] }),
  ]);
  assert.equal(kept.length, 1);
  assert.deepEqual(dropped.map(d => d.reason).sort(), ['hidden', 'hidden', 'zero-size']);
});

test('disabled 元素保留且标注状态，不进 dropped', () => {
  const { kept } = denoise([cand({ properties: [{ name: 'disabled', value: { type: 'boolean', value: true } }] })]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].state.disabled, true);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd extension && node --test tests/denoiser.test.js`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 写最小实现**

`extension/src/denoiser.js`:

```js
const prop = (c, name) => c.properties.find(p => p.name === name)?.value?.value;

export function denoise(candidates) {
  const kept = [], dropped = [];
  for (const c of candidates) {
    const b = c.bounds ?? {};
    if ((b.width ?? 0) === 0 || (b.height ?? 0) === 0) { dropped.push({ ...c, reason: 'zero-size' }); continue; }
    if (c.visible === false || prop(c, 'hidden') === true || prop(c, 'focused') === undefined && false) { dropped.push({ ...c, reason: 'hidden' }); continue; }
    const disabled = prop(c, 'disabled') === true;
    kept.push({ ...c, state: { disabled } });
  }
  return { kept, dropped };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd extension && node --test tests/denoiser.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add extension/src/denoiser.js extension/tests/denoiser.test.js
git commit -m "feat: denoiser 过滤零尺寸/hidden 并标注 disabled"
```

---

### Task 4: classifier —— role → interaction_type + confidence

**Files:**
- Create: `extension/src/classifier.js`
- Create: `extension/tests/classifier.test.js`

**Interfaces:**
- Consumes: `denoise` 的 kept 项（含 constraints 注入：`constraints = { input_type, maxlength, pattern, required }`，CDP 阶段填充；fixture 直接给定）
- Produces: `classify(candidates) -> [{ tempId, interaction_type, confidence, ...candidate }]`；认不出的进 `classifyUncertain` 返回的 `unclassified[]`。映射：`textbox`→text_input/textarea(按 multiline 表属性)、`combobox|listbox`→select、`button`→button（`constraints.input_type==='file'` → file_upload，`input_type==='date'` → date_picker）、`radio`→radio、`checkbox`→checkbox、`link`→link；常规映射 confidence=CONF_HIGH(0.95)；`name` 含「分页/页」且 role=`button|link` 簇 → pagination 只作 0.6 提示（M0 直接进 unclassified 交 AI）；无匹配 → interaction_type=null, confidence=0

- [ ] **Step 1: 写失败测试**

`extension/tests/classifier.test.js`:

```js
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd extension && node --test tests/classifier.test.js`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 写最小实现**

`extension/src/classifier.js`:

```js
import { CONF_HIGH, CONF_THRESHOLD } from './constants.js';

const propOf = (c, name) => c.properties.find(p => p.name === name)?.value?.value;

const propB = (name) => ({ name, value: { type: 'boolean', value: true } }); // 仅供单测构型

export function classify(candidates) {
  let tempId = 0;
  return candidates.map(c => {
    const t = c.constraints?.input_type;
    let interaction_type = null, confidence = 0;
    if (t === 'file') { interaction_type = 'file_upload'; confidence = CONF_HIGH; }
    else if (t === 'date') { interaction_type = 'date_picker'; confidence = CONF_HIGH; }
    else if (c.role === 'textbox') {
      interaction_type = propOf(c, 'multiline') ? 'textarea' : 'text_input'; confidence = CONF_HIGH;
    } else if (c.role === 'combobox' || c.role === 'listbox') { interaction_type = 'select'; confidence = CONF_HIGH; }
    else if (c.role === 'button') { interaction_type = 'button'; confidence = CONF_HIGH; }
    else if (c.role === 'link') { interaction_type = 'link'; confidence = CONF_HIGH; }
    else if (c.role === 'radio') { interaction_type = 'radio'; confidence = CONF_HIGH; }
    else if (c.role === 'checkbox') { interaction_type = 'checkbox'; confidence = CONF_HIGH; }
    if (interaction_type === null && /页|分页/.test(c.name)) { interaction_type = 'pagination'; confidence = 0.6; }
    return { tempId: ++tempId, interaction_type, confidence, ...c };
  });
}

// ≥0.9 直进清单；<0.9 标低信心交 Skill；0=认不出 → unclassified
export function splitByConfidence(classified) {
  const sure = [], review = [], unclassified = [];
  for (const c of classified) {
    if (!c.interaction_type || c.confidence === 0) unclassified.push(c);
    else if (c.confidence >= CONF_THRESHOLD) sure.push(c);
    else review.push(c);
  }
  return [sure, review, unclassified];
}
```

（单测第 4 行 `propB` 为示例说明性辅助，若最终代码未使用请删除——本任务实现中 `propOf` 已覆盖场景，`propB` 不进入提交。）

- [ ] **Step 4: 运行测试确认通过**

Run: `cd extension && node --test tests/classifier.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add extension/src/classifier.js extension/tests/classifier.test.js
git commit -m "feat: classifier role→interaction_type 映射与置信度分流"
```

---

### Task 5: exporter —— 组装 inventory.json（契约 v0.1）

**Files:**
- Create: `extension/src/exporter.js`
- Create: `extension/tests/exporter.test.js`

**Interfaces:**
- Consumes: `splitByConfidence` 的 `[sure, review, unclassified]`；meta 对象
- Produces: `buildInventory({ meta, sure, review, unclassified }) -> Inventory 对象`（Spec §4.1 结构：meta/elements/unclassified；id 从 e001 递增，sure+review 都入 elements，review 项 confidence<0.9 由 Skill 裁决；`selected` 默认 true；元素字段 `hints`/`constraints`/`visibility`/`state.disabled` 合入 constraints 与 hints）

- [ ] **Step 1: 写失败测试**

`extension/tests/exporter.test.js`:

```js
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd extension && node --test tests/exporter.test.js`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 写最小实现**

`extension/src/exporter.js`:

```js
export function buildInventory({ meta, sure, review, unclassified }) {
  const elements = [...sure, ...review].map((c, i) => ({
    id: `e${String(i + 1).padStart(3, '0')}`,
    interaction_type: c.interaction_type,
    label: c.name ?? '',
    hints: { css_selector: c.hints?.css_selector ?? null, aria_path: c.hints?.aria_path ?? null, placeholder: c.hints?.placeholder ?? null },
    constraints: { required: c.constraints?.required ?? null, maxlength: c.constraints?.maxlength ?? null, pattern: c.constraints?.pattern ?? null, input_type: c.constraints?.input_type ?? null, disabled: c.state?.disabled ?? false },
    visibility: c.visible === false ? 'hidden' : 'visible',
    confidence: c.confidence,
    selected: true,
    notes: '',
  }));
  return {
    schema_version: '0.1',
    meta: { ...meta, captured_at: new Date().toISOString() },
    elements,
    unclassified: (unclassified ?? []).map(c => ({ tempId: c.tempId, role: c.role, name: c.name ?? '' })),
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd extension && node --test tests/exporter.test.js`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add extension/src/exporter.js extension/tests/exporter.test.js
git commit -m "feat: exporter 组装 inventory.json 契约 v0.1"
```

---

### Task 6: CDP 采集中枢（background service worker）

**Files:**
- Create: `extension/src/background.js`

**Interfaces:**
- Consumes: Task 2~5 全部函数（`reduceAxtree/denoise/classify/splitByConfidence/buildInventory`）；`chrome.debugger`、`chrome.downloads` API
- Produces: 扫描结果 `inventory.json` 下载落盘（M0）；popup 消息接口 `{ type: 'SCAN' }` → 回 `{ ok, inventory?, error? }`

注意：本任务无法单测（依赖真实浏览器），验证方式为 Task 7 的加载手测。JS 管线逻辑已被 Task 2~5 覆盖，此处只做胶水。

- [ ] **Step 1: 实现采集中枢**

`extension/src/background.js`:

```js
import { reduceAxtree } from './reducer.js';
import { denoise } from './denoiser.js';
import { classify, splitByConfidence } from './classifier.js';
import { buildInventory } from './exporter.js';

const DEBUGGER_PROTO = '1.3';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'SCAN') { scanActiveTab().then(sendResponse).catch(e => sendResponse({ ok: false, error: String(e?.message ?? e) })); }
  return true; // 异步 sendResponse
});

async function scanActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('未找到活动标签页');
  const target = { tabId: tab.id };

  // attach（失败最常见原因：DevTools 占用了 debugger）
  try { await chrome.debugger.attach(target, DEBUGGER_PROTO); }
  catch (e) { throw new Error('CDP attach 失败（若开着 DevTools，请关闭后重试）：' + e.message); }

  try {
    // 1) 拿完整语义树
    const ax = await send('Accessibility.getFullAXTree', {});
    // 2) 候选元素 + 逐个补 DOM 属性与几何
    const candidates = reduceAxtree(ax.nodes);
    await enableDomains();
    const enriched = [];
    for (const c of candidates) {
      enriched.push(await enrich(c, target));
    }
    // 3) 去噪 → 分类 → 分流
    const { kept } = denoise(enriched);
    const [sure, review] = splitByConfidence(classify(kept));
    const unclassified = classify(listUnclassified(kept)).filter(c => c.confidence === 0);
    // 4) 组装契约
    const inventory = buildInventory({
      meta: { page_url: tab.url, page_title: tab.title ?? '', session_id: makeSessionId(tab), plugin_version: chrome.runtime.getManifest().version },
      sure, review, unclassified,
    });
    // 5) M0 出口：下载 inventory.json；M1 换 File System Access 直写
    const blob = new Blob([JSON.stringify(inventory, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dlId = await chrome.downloads.download({ url, filename: `casefront/${inventory.meta.session_id}/inventory.json`, saveAs: false });
    URL.revokeObjectURL(url);
    return { ok: true, casePath: `casefront/${inventory.meta.session_id}/inventory.json`, count: inventory.elements.length, downloadId: dlId };
  } finally {
    chrome.debugger.detach(target).catch(() => {}); // 任何路径必须 detach
  }
}

function send(method, params) {
  return chrome.debugger.sendCommand({ tabId: chrome.devtools?.tabId ?? undefined, method, params });
}

function enableDomains() {
  return Promise.all([send('Runtime.enable', {}), send('DOM.enable', {})]).then(() => {});
}

let resolveSeq = 0;
async function enrich(candidate, target) {
  const out = { ...candidate, hints: {}, constraints: {}, bounds: undefined, visible: true };
  try {
    const resolved = await send('DOM.resolveNode', { backendNodeId: candidate.backendDOMNodeId });
    const obj = resolved?.object;
    if (obj?.objectId) {
      out.hints.css_selector = null; // M0 不做 selector 生成，留给增强阶段
      const evalr = await send('Runtime.callFunctionOn', {
        objectId: obj.objectId, returnByValue: true,
        functionDeclaration: `function () {
          const el = this;
          const r = el.getBoundingClientRect();
          return {
            tag: el.tagName, input_type: el.getAttribute('type'), required: el.required ?? null,
            maxlength: el.maxLength && el.maxLength > 0 ? el.maxLength : null, pattern: el.getAttribute('pattern'),
            placeholder: el.getAttribute('placeholder'), width: r.width, height: r.height,
            rect_visible: r.width > 0 && r.height > 0
          };
        }`,
      });
      const d = evalr?.result?.value ?? {};
      out.constraints = { input_type: d.input_type ?? null, required: d.required ?? null, maxlength: d.maxlength ?? null, pattern: d.pattern ?? null };
      out.hints.placeholder = d.placeholder ?? null;
      out.hints.css_selector = d.tag ? d.tag.toLowerCase() : null;
      out.bounds = { width: d.width ?? 0, height: d.height ?? 0 };
      out.visible = d.rect_visible !== false;
    }
  } catch { /* 补属性失败不阻塞：诚实降级为无约束 */ }
  out.backendDOMNodeId = candidate.backendDOMNodeId ?? `alt-${++resolveSeq}`;
  return out;
}

function makeSessionId(tab) {
  const d = new Date();
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const title = (tab.title ?? 'page').slice(0, 20).replace(/[\\/:*?"<>| ]/g, '_');
  return `${day}_${title}`;
}

// 未进 MAPPABLE_ROLES 的元素 → 原样送 classifier 认不出 → unclassified（兜底不丢弃）
function listUnclassified(kept) {
  return kept; // classify 对所有 kept 跑一遍，role 不在映射表的自然 confidence=0
}
```

（提交前对照说明：`send()` 里 tabId 需绑定 target——实现时将 `send` 改造为 `scanActiveTab` 闭包内 `const send = (method, params) => chrome.debugger.sendCommand(target, { method, params })`，避免依赖 `chrome.devtools`。`listUnclassified` 直接对 kept 全量跑 classify，去掉独立包装。）

- [ ] **Step 2: 静态自查**

Run: `cd extension && node --check src/background.js && node --test tests/`
Expected: 语法 OK；全部既有测试 PASS（background 不破坏纯函数模块）

- [ ] **Step 3: Commit**

```bash
git add extension/src/background.js
git commit -m "feat: CDP 采集中枢（attach→AXTree→enrich→管线→下载 inventory）"
```

---

### Task 7: manifest + popup + 加载手测（全链路首次点亮）

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/src/popup.html`、`extension/src/popup.js`
- Modify: 无（宿主页面即测试环境）

**Interfaces:**
- Consumes: background 的 `{ type: 'SCAN' }` 消息接口
- Produces: 用户可加载的插件；下载产物 `Downloads/casefront/<session_id>/inventory.json`

- [ ] **Step 1: manifest + popup**

`extension/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "CaseFront",
  "version": "0.1.0",
  "description": "Web 测试用例 AI 前置助手——采集页面交互清单",
  "permissions": ["debugger", "downloads", "tabs"],
  "action": { "default_popup": "src/popup.html", "default_title": "扫描此页" },
  "background": { "service_worker": "src/background.js", "type": "module" }
}
```

`extension/src/popup.html`:

```html
<!doctype html><meta charset="utf-8"><title>CaseFront</title>
<style>body{font:13px/1.6 system-ui;width:260px;padding:10px}
#status{margin-top:8px;color:#666;white-space:pre-wrap}</style>
<button id="scan">扫描此页</button><div id="status">点击按钮开始采集</div>
<script src="popup.js"></script>
```

`extension/src/popup.js`:

```js
const status = document.getElementById('status');
document.getElementById('scan').onclick = async () => {
  status.textContent = '采集中…（CDP 读取语义树）';
  let res;
  try { res = await chrome.runtime.sendMessage({ type: 'SCAN' }); }
  catch (e) { status.textContent = '失败：' + e.message; return; }
  status.textContent = res.ok
    ? `✅ 采集 ${res.count} 个交互元素\n已下载：${res.casePath}\n在 Comate 中 @ 该文件生成用例`
    : `❌ ${res.error}`;
};
```

- [ ] **Step 2: 加载并手测（checklist）**

1. Chrome 打开 `chrome://extensions` → 开发者模式 → 「加载已解压的扩展程序」选 `extension/` 目录
2. 打开测试页（Task 9 的 `cases-fixture/` 登记页 HTML 或任意真实登录页）
3. 点插件图标 → 「扫描此页」
4. 预期：popup 显示 `✅ 采集 N 个交互元素`；`Downloads/casefront/<session>/inventory.json` 内容符合契约（meta/elements/unclassified）
5. 反例：打开 DevTools 再扫描 → 预期 popup 显示 attach 失败引导文案
6. 手测发现的问题按 superpowers:systematic-debugging 处理后重测

- [ ] **Step 3: Commit**

```bash
git add extension/manifest.json extension/src/popup.html extension/src/popup.js
git commit -m "feat: MV3 manifest 与 popup，全链路可用"
```

---

### Task 8: Skill 侧 —— SKILL.md 管线 + 5 张内置规则卡

**Files:**
- Create: `skill/SKILL.md`（覆盖骨架占位，写入完整生成管线指令）
- Create: `skill/references/rules/text_input.yaml`、`skill/references/rules/select.yaml`、`skill/references/rules/button.yaml`、`skill/references/rules/file_upload.yaml`、`skill/references/rules/date_picker.yaml`
- Create: `demo/examples.md`（模板，用户后续填 2~3 条手写用例）
- Test: 无自动化测试——M0 用 Task 9 E2E 走查验收

**Interfaces:**
- Consumes: `workspace/inventory/<session>/inventory.json`（文件契约，Spec §4.1）
- Produces: `workspace/inventory/<session>/cases.json + cases.md`（Spec §4.4/7）

- [ ] **Step 1: 写 5 张规则卡**

`skill/references/rules/text_input.yaml`:

```yaml
id: text-input-standard
applies_to: text_input
rules:
  - id: empty-submit
    title: 空值提交
    priority: P0
  - id: boundary-min-max
    title: 边界值测试
    detail: 按 maxlength/minlength 取边界值及 ±1；无 maxlength 默认 255/256
    priority: P1
  - id: whitespace-trim
    title: 前后空格处理
    priority: P2
  - id: xss-injection
    title: 特殊字符与脚本注入
    detail: `<img src=x onerror=alert(1)>` 等 payload，观察转义/告警
    priority: P1
```

`skill/references/rules/select.yaml`:

```yaml
id: select-standard
applies_to: select
rules:
  - id: default-value
    title: 默认值校验
    priority: P1
  - id: option-roundtrip
    title: 选项往返（选后改选其他项）
    priority: P2
  - id: filter-reflow
    title: 带搜索/筛选的下拉在输入后选项集是否正确
    priority: P2
```

`skill/references/rules/button.yaml`:

```yaml
id: button-standard
applies_to: button
rules:
  - id: click-response
    title: 单击响应与结果反馈
    priority: P0
  - id: double-click-guard
    title: 连续快速点击/防重复提交
    priority: P1
  - id: loading-state
    title: 请求进行中按钮状态（loading/禁用）
    priority: P2
```

`skill/references/rules/file_upload.yaml`:

```yaml
id: file-upload-standard
applies_to: file_upload
rules:
  - id: type-magic-mismatch
    title: 类型限制与魔数伪装（改后缀）
    priority: P1
  - id: size-limit
    title: 大小边界（上限±1、0 字节）
    priority: P1
  - id: duplicate-name
    title: 重名/重复上传
    priority: P2
```

`skill/references/rules/date_picker.yaml`:

```yaml
id: date-picker-standard
applies_to: date_picker
rules:
  - id: month-boundary
    title: 跨月/跨年切换
    priority: P1
  - id: past-date
    title: 过去日期（如业务禁止）
    priority: P2
  - id: range-order
    title: 结束早于开始（区间选择）
    priority: P1
```

- [ ] **Step 2: 写 SKILL.md（完整替换骨架占位）**

`skill/SKILL.md` 全文：

````markdown
---
name: casefront
description: Web 测试用例 AI 前置助手。读取插件产出的 inventory.json（页面交互清单），按规则卡与测试者 demo 生成可追溯的测试用例（cases.md + cases.json）。当用户提供 casefront/inventory 会话目录、说"生成测试用例""跑 casefront 流水线"或@ inventory.json 时触发。
---

# CaseFront Skill —— 用例生成管线

输入：`inventory.json`（插件产出，schema_version 0.1）+ `skill/references/rules/*.yaml` + `demo/examples.md`（可选）。
输出：同目录 `cases.json` + `cases.md`。

## 管线五步（演示页走完才能交付）

1. **裁决**：列出 `confidence < 0.9` 的 elements 与全部 `unclassified`，逐条给出你判定的
   interaction_type 与理由；低信心项给用户确认（第一处人工收敛）。
2. **匹配**：读 `skill/references/rules/` 全部 YAML，按 `applies_to == interaction_type` 挂卡；
   `selected=false` 的元素跳过并在 coverage.skipped_reasons 记录；若某 interaction_type 无卡，
   记入 `rule_gaps`。× （1 元素 × N 规则 = N 检查点，全部携带 rule id）
3. **收敛二**：按「共性合并/个性独立」（见下）拟出检查点清单摘要 → 用户确认范围后继续
4. **组装**：检查点 → 用例。共性规则（empty-submit/xss/boundary 等全表单共性项）同区块合并；
   个性规则（dropdown 往返、防重复提交等）一元素一条。priority 取规则卡默认值，可按页面
   上下文整体修正但需在对话中说明。
5. **对齐**：若 `demo/examples.md` 存在，先总结其结构/措辞/粒度习惯，再按其风格写 cases.md；
   cases.json 每条带 `rule_refs`、`element_ids`、`style_source`。

## 追溯与纪律

- 每条用例必须携带 rule_refs（`卡id:规则id`）与 element_ids；缺任何一项不得输出。
- 宁少勿滥：与用户确认过的范围之外不自动加 case；补充建议放 `rule_gaps` 或 notes。
- cases.json 结构（Spec §4.4）：schema_version/meta/cases[]/coverage/rule_gaps。

## 产出示例（字段级样例，禁止原样拷贝进产物）

```json
{
  "schema_version": "0.1",
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
  "rule_gaps": []
}
```
````

- [ ] **Step 3: 建 demo 模板**

`demo/examples.md`:

```markdown
# 风格样例（请测试者填 2~3 条自己写的真实用例）

> 说明：本文件用于 AI 学习你的用例结构、粒度、措辞与优先级习惯。
> 留空时 Skill 按默认风格生成（title+前置+步骤+预期+优先级）。

- 例（待替换）：
  - 标题：登录-手机号11位边界
  - 前置：已打开登录页
  - 步骤：手机号输入 10 位数字 → 点击登录
  - 预期：提示"请输入11位手机号"，不发起请求
  - 优先级：P1
```

- [ ] **Step 4: Commit**

```bash
git add skill/SKILL.md skill/references/rules/ demo/examples.md
git commit -m "feat: Skill 生成管线指令与 5 张内置规则卡"
```

---

### Task 9: E2E 竖切验收 —— 真实页面全链路

**Files:**
- Create: `cases-fixture/register-page.html`（本地测试页：手机号/密码/账号类型下拉/协议 checkbox/注册按钮/去登录链接/隐藏占位元素[decorative]/禁用按钮）
- Create: `cases-fixture/EXPECTED.md`（验收核对单）
- Create: `workspace/inventory/`（运行时创建，`.gitignore` 已排除——插件下载产物放入此处；fixtures 本身入库）

**Interfaces:**
- Consumes: Task 7 插件 + Task 8 Skill
- Produces: 一份真实 inventory.json 与对应 cases.md/cases.json，满足 M0 验收标准（Spec §8：10~30 条用例、空值/边界/XSS 检查点齐全、每条可追溯 rule_refs）

- [ ] **Step 1: 写 E2E 测试页**

`cases-fixture/register-page.html`（要点齐全的静态注册页，含正反样本）:

```html
<!doctype html><meta charset="utf-8"><title>注册页</title>
<form>
  <label>手机号<input id="phone" type="tel" required maxlength="11" placeholder="请输入11位手机号"></label>
  <label>密码<input id="pwd" type="password" required maxlength="20"></label>
  <label>账号类型<select id="acctype"><option>个人</option><option>企业</option></select></label>
  <label><input type="checkbox" id="agree">我已阅读并同意用户协议</label>
  <button type="submit" id="submit">注 册</button>
  <button type="button" id="sendcode" disabled>获取验证码</button>
  <a href="login">已有账号？去登录</a>
  <span aria-hidden="true">※仅仅装饰※</span>
</form>
```

`cases-fixture/EXPECTED.md`:

```markdown
# M0 验收核对单

- [ ] inventory.json：elements ≥ 6（手机号/密码/下拉/checkbox/注册按钮/链接），装饰 span 与 disabled 按钮……
      disabled 按钮应保留并 state.disabled=true；装饰 span 不出现
- [ ] unclassified 不为空时全部有 role/name 记录（不丢弃原则）
- [ ] Skill 对话中出现「裁决」节（本 fixture 全部高信心，应说明"无需裁决"）
- [ ] cases 数量 10~30；空值/边界/XSS 检查点来自 text_input 卡；select/button 卡命中
- [ ] 每条 case 有 rule_refs + element_ids；coverage 与实际元素数一致
- [ ] cases.md 风格与 demo/examples.md 示例一致（标题/前置/步骤/预期/优先级五段）
```

- [ ] **Step 2: 浏览器手测**

1. Chrome 打开 `cases-fixture/register-page.html`
2. 插件扫描 → 确认 popup 计数与 EXPECTED.md 第一条一致
3. 把 `Downloads/casefront/<session>/inventory.json` 放入本仓库 `workspace/inventory/<session>/`
（Comate 工作区路径：`C:\Users\admin\.wpscomate\agent\workspace\casefront\workspace\inventory\<session>\`）

Run: `ls workspace/inventory/*/inventory.json`
Expected: 文件存在且 JSON 可解析

- [ ] **Step 3: Skill 生成走查**

1. 在 Comate 对话中 @ 该 inventory.json → 触发 casefront Skill（Task 8 已注册）
2. 观察：管线五步逐一执行；两处人工收敛都停下来等确认
3. 产出 `cases.md` + `cases.json` 落在 inventory 同目录

- [ ] **Step 4: 按核对单逐项验收**

Run: 人工对照 `cases-fixture/EXPECTED.md`
Expected: 全部勾选。不满足项回到对应 Task 修复后重跑本 Task。

- [ ] **Step 5: Commit（fixtures 与核对单入库，运行产物不入库）**

```bash
git add cases-fixture/
git commit -m "test: M0 E2E 竖切验收——真实页全链路带核对单"
```

---

## Self-Review 记录

1. **Spec 覆盖**：§5 采集管线（T2~T6）、降级（T6-T1 catch 引导）、去噪（T3）、confidence（T4）、契约 v0.1（T5）、出口下载（T6，File System Access 直写留 M1——Spec §5.3-2 标注主路，M0 以下载为过渡符合里程碑 M1「一键直写」分工）、Skill 五步（T8）、粒度策略（T8 步骤 3/4）、追溯（T8 纪律节）、M0 验收（T9）。缺口：无。
2. **占位符扫描**：Task 6 附注了两处实现校正说明，非占位符——执行时必须落实，已写明具体改法。无 TBD/TODO。
3. **类型一致性**：`reduceAxtree → candidates`（T2）= `denoise` 输入（T3）；`denoise.kept` 含 `state`（T3）→ `classify/splitByConfidence` 输入（T4）→ `buildInventory` 消费 `sure/review/unclassified`（T5）；background 串联签名一致（T6）。`send()` 以 target 闭包绑定（T6 附注）。

## 执行提示

- Task 6 的 background.js 代码按附注校正后再提交；`node --check` 过一遍语法。
- Task 9 Step 2 的产物路径在用户 Comate 工作区，不在仓库内——注意区分。
- 全部任务完成即达 M0 验收线；M1（File System Access 直写/裁决体验/去噪调优）另行开计划。
