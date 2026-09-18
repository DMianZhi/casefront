# WXT + React + TypeScript 插件重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 WXT + React + TypeScript 重构 `extension/`，行为与 inventory.json 契约完全不变，为 M2/M3 打基础。

**Architecture:** `extension/` 成为独立 WXT 项目（entrypoints 约定 + 自动 manifest）；纯逻辑迁入 `lib/`（全 TS、UI/运行时解耦）；popup 用 React + Tailwind 重写；popup↔background 消息协议类型化。旧 `src/` 在切换完成前保持可加载（WXT 产物输出到 `.output/`，二者不冲突）。

**Tech Stack:** WXT、React 19、TypeScript（strict + noUncheckedIndexedAccess）、Tailwind CSS v4、Vitest + @testing-library/react + jsdom、Node ≥ 22。

**Spec:** `docs/superpowers/specs/2026-09-19-wxt-react-refactor-design.md`

## Global Constraints

- 行为不变：去噪阈值、折叠签名、置信度分流、session_id 生成等算法逐行等价迁移；TS 严格化暴露的行为差异必须单独记录并向用户确认，禁止静默"顺手修"
- 契约不变：`schema_version: '0.1'`、`inventory.json` 字段结构不变（设计文档 §4.1）
- 权限不变：`debugger` / `downloads` / `tabs`
- 错误处理风格不变："诚实降级"——enrich 失败不阻塞、IDB 失败不阻塞导出、debugger 任何路径必须 detach
- 版本 bump 至 `0.3.0`
- 每个任务结束跑 `cd extension && npm test`（Task 1 起可用）并提交
- 遵守根 `KSCC.md` 7 维自查协议，输出代码附《自查报告》

---

### Task 1: WXT 项目脚手架（构建链 + Vitest，旧版仍可加载）

**Files:**
- Create: `extension/wxt.config.ts`, `extension/tsconfig.json`, `extension/package.json`（重写）, `extension/entrypoints/popup/index.html`（临时骨架）, `extension/entrypoints/popup/main.tsx`（临时骨架）, `extension/entrypoints/popup/App.tsx`（临时骨架）, `extension/tests/smoke.test.ts`
- Modify: 无（旧 `src/`、旧 `manifest.json` 暂留）

**Interfaces:**
- Produces: `npm run dev` / `npm run build` / `npm test` / `npm run zip` 四条命令；`.output/chrome-mv3` 产物目录；TS 编译基线

- [ ] **Step 1: 重写 package.json，安装依赖**

`extension/package.json` 全量替换为：

```json
{
  "name": "casefront-extension",
  "version": "0.3.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wxt",
    "build": "wxt build",
    "zip": "wxt zip",
    "compile": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

然后：

```bash
cd extension && npm install -D wxt typescript react react-dom @types/react @types/react-dom \
  tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

（WXT 内置 react 模板支持；react/react-dom 以 dependencies 安装亦可，保持 devDependencies 也允许——产物由打包器内联，不影响 MV3 零运行时依赖。）

- [ ] **Step 2: 写 wxt.config.ts**

```ts
import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'CaseFront',
    description: 'Web 测试用例 AI 前置助手——采集页面交互清单',
    permissions: ['debugger', 'downloads', 'tabs'],
    action: { default_title: '扫描此页' },
  },
});
```

同时 `npm install -D @wxt-dev/module-react`。

- [ ] **Step 3: 写 tsconfig.json**

```json
{
  "extends": "./.wxt/tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["entrypoints", "lib", "tests", ".wxt/wxt.d.ts"]
}
```

（`.wxt/tsconfig.json` 由 `wxt prepare` 生成；`@/*` 路径别名指向仓库根。）

- [ ] **Step 4: 临时 popup 骨架（验证工具链通即可）**

`extension/entrypoints/popup/index.html`：

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>CaseFront</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

`extension/entrypoints/popup/main.tsx`：

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`extension/entrypoints/popup/App.tsx`：

```tsx
export default function App() {
  return <div style={{ width: 380, padding: 14 }}>CaseFront 0.3.0 工具链验证</div>;
}
```

`extension/entrypoints/popup/style.css` 暂为空文件（Task 7 填充）。

- [ ] **Step 5: 生成类型与构建验证**

```bash
cd extension && npx wxt prepare && npm run build
```

Expected: `.output/chrome-mv3/` 生成，内含 `manifest.json`（permissions 三项齐全、版本 0.3.0）与 popup 页。

- [ ] **Step 6: Vitest 冒烟测试**

`extension/tests/smoke.test.ts`：

```ts
import { describe, expect, it } from 'vitest';

describe('工具链冒烟', () => {
  it('TS + vitest 可用', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `cd extension && npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add extension && git commit -m "chore(extension): WXT+React+TS 脚手架（工具链验证，旧版仍可加载）"
```

---

### Task 2: 契约类型单一事实源（lib/inventory.ts + lib/constants.ts）

**Files:**
- Create: `extension/lib/constants.ts`, `extension/lib/inventory.ts`, `extension/tests/inventory-types.test.ts`

**Interfaces:**
- Produces（后续所有任务依赖，精确签名）:
  - `type InteractionType = 'text_input' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'button' | 'link' | 'file_upload' | 'date_picker' | 'pagination' | 'dialog' | 'tabs'`
  - `const CONF_THRESHOLD = 0.9; const CONF_HIGH = 0.95; const CONF_LOW = 0.6; const INTERACTION_TYPES: readonly InteractionType[]`
  - `interface Candidate { backendDOMNodeId: number | string | null; role: string; name: string; ignored: boolean; properties: AxProperty[]; parentId?: string | null; bounds?: { width?: number; height?: number }; }`
  - `interface AxProperty { name: string; value: { type: string; value: unknown } }`
  - `interface EnrichedCandidate extends Candidate { hints: ElementHints; constraints: ElementConstraints; visible: boolean; state: { disabled: boolean }; }`
  - `interface ClassifiedElement extends EnrichedCandidate { tempId: number; interaction_type: InteractionType | null; confidence: number; __group?: { kind: 'prefix' | 'suffix'; signature: string; member_count?: number; memberCount?: number }; }`
  - `interface ElementHints { css_selector: string | null; aria_path: string | null; placeholder: string | null }`
  - `interface ElementConstraints { required: boolean | null; maxlength: number | null; pattern: string | null; input_type: string | null; disabled: boolean }`
  - `interface ElementGroup { kind: 'prefix' | 'suffix'; signature: string; member_count: number }`
  - `interface InventoryElement { id: string; interaction_type: InteractionType | null; label: string; hints: ElementHints; constraints: ElementConstraints; visibility: 'visible' | 'hidden'; confidence: number; selected: boolean; group?: ElementGroup; notes: string }`
  - `interface InventoryMeta { page_url: string; page_title: string; session_id: string; plugin_version: string; scan_mode: 'compact' | 'full'; captured_at?: string; exported_at?: string }`
  - `interface UnclassifiedItem { tempId: number; role: string; name: string }`
  - `interface Inventory { schema_version: '0.1'; session_id?: string; meta: InventoryMeta; elements: InventoryElement[]; unclassified: UnclassifiedItem[] }`

- [ ] **Step 1: 写失败测试**

`extension/tests/inventory-types.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { CONF_HIGH, CONF_LOW, CONF_THRESHOLD, INTERACTION_TYPES } from '../lib/constants';
import type { InteractionType } from '../lib/constants';

describe('constants', () => {
  it('12 个交互类型，与 skill 规则卡一一对应', () => {
    expect(INTERACTION_TYPES).toHaveLength(12);
    expect(INTERACTION_TYPES).toContain('text_input');
    expect(INTERACTION_TYPES).toContain('tabs');
  });
  it('置信度常量不变', () => {
    expect(CONF_THRESHOLD).toBe(0.9);
    expect(CONF_HIGH).toBe(0.95);
    expect(CONF_LOW).toBe(0.6);
  });
  it('InteractionType 联合与数组同源（类型级检查，运行期取样验证）', () => {
    const t: InteractionType = INTERACTION_TYPES[0]!;
    expect(INTERACTION_TYPES).toContain(t);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd extension && npm test -- inventory-types`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 lib/constants.ts**

```ts
export const INTERACTION_TYPES = Object.freeze([
  'text_input', 'textarea', 'select', 'radio', 'checkbox',
  'button', 'link', 'file_upload', 'date_picker', 'pagination',
  'dialog', 'tabs',
] as const) satisfies readonly string[];

export type InteractionType = (typeof INTERACTION_TYPES)[number];
export const CONF_THRESHOLD = 0.9;
export const CONF_HIGH = 0.95;
export const CONF_LOW = 0.6;
```

- [ ] **Step 4: 实现 lib/inventory.ts（纯类型 + Candidate 家族）**

```ts
import type { InteractionType } from './constants';

// ---- CDP aXTree 属性（reducer/classifier 用到的最小子集）----
export interface AxProperty {
  name: string;
  value: { type: string; value: unknown };
}

// ---- 候选元素家族（内部管线类型，非契约）----
export interface Candidate {
  backendDOMNodeId: number | string | null;
  role: string;
  name: string;
  ignored: boolean;
  properties: AxProperty[];
  parentId?: string | null;
  bounds?: { width?: number; height?: number };
}

export interface ElementHints {
  css_selector: string | null;
  aria_path: string | null;
  placeholder: string | null;
}

export interface ElementConstraints {
  required: boolean | null;
  maxlength: number | null;
  pattern: string | null;
  input_type: string | null;
  disabled: boolean;
}

export interface EnrichedCandidate extends Candidate {
  hints: ElementHints;
  constraints: ElementConstraints;
  visible: boolean;
  state: { disabled: boolean };
}

export interface GroupInfo {
  kind: 'prefix' | 'suffix';
  signature: string;
  member_count?: number;
  memberCount?: number;
}

export interface ClassifiedElement extends EnrichedCandidate {
  tempId: number;
  interaction_type: InteractionType | null;
  confidence: number;
  __group?: GroupInfo;
}

// ---- inventory.json 契约（schema_version 0.1，设计文档 §4.1）----
export interface ElementGroup {
  kind: 'prefix' | 'suffix';
  signature: string;
  member_count: number;
}

export interface InventoryElement {
  id: string;
  interaction_type: InteractionType | null;
  label: string;
  hints: ElementHints;
  constraints: ElementConstraints;
  visibility: 'visible' | 'hidden';
  confidence: number;
  selected: boolean;
  group?: ElementGroup;
  notes: string;
}

export interface InventoryMeta {
  page_url: string;
  page_title: string;
  session_id: string;
  plugin_version: string;
  scan_mode: 'compact' | 'full';
  captured_at?: string;
  exported_at?: string;
}

export interface UnclassifiedItem {
  tempId: number;
  role: string;
  name: string;
}

export interface Inventory {
  schema_version: '0.1';
  session_id?: string;
  meta: InventoryMeta;
  elements: InventoryElement[];
  unclassified: UnclassifiedItem[];
}
```

- [ ] **Step 5: 跑测试与类型检查**

Run: `cd extension && npm test && npm run compile`
Expected: 全部 PASS，tsc 无错

- [ ] **Step 6: Commit**

```bash
git add extension/lib extension/tests/inventory-types.test.ts
git commit -m "feat(extension): inventory 契约类型单一事实源（lib/inventory.ts）"
```

---

### Task 3: 迁移 reducer + denoiser（TS 化，算法逐行等价）

**Files:**
- Create: `extension/lib/reducer.ts`, `extension/lib/denoiser.ts`
- Test: `extension/tests/reducer.test.ts`, `extension/tests/denoiser.test.ts`（迁移自旧 tests，断言不变）
- Modify: 旧 `extension/src/reducer.js`、`extension/src/denoiser.js` 暂留（切换前可对照）

**Interfaces:**
- Consumes: Task 2 的 `Candidate` / `EnrichedCandidate` / `AxProperty`
- Produces: `reduceAxtree(nodes: AxNode[]): Candidate[]`；`denoise(candidates: EnrichedCandidate[]): { kept: EnrichedCandidate[]; dropped: (EnrichedCandidate & { reason: string })[] }`
- 依赖的 `AxNode` 类型在本任务内联到 `lib/reducer.ts` 并 export（Task 6 的 cdp-types 引用）：`interface AxNode { nodeId: string; backendDOMNodeId?: number; ignored?: boolean; role?: { type: string; value: string }; name?: { value: string }; childIds?: string[]; properties?: AxProperty[] }`

- [ ] **Step 1: 迁移测试文件（只改 import 与跑法，断言逐字保留）**

旧 `tests/reducer.test.js` → 新 `tests/reducer.test.ts`：把

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
```

替换为

```ts
import { describe, expect, it } from 'vitest';
```

并把每个 `test('…', () => { … assert.equal(a, b) … })` 机械改为 `it('…', () => { … expect(a).toBe(b) … })`（`assert.deepEqual` → `toEqual`，`assert.ok` → `toBeTruthy`）。原文件共 27 行、全部用例保留。旧测试对 `../src/reducer.js` 的 import 全部改为 `../lib/reducer`。若某用例依赖了 TS 推断不出的字段，用 `as` 断言补齐类型而非放宽实现。

- [ ] **Step 2: 跑测试确认失败**

Run: `cd extension && npm test -- reducer`
Expected: FAIL（`../lib/reducer` 不存在）

- [ ] **Step 3: 实现 lib/reducer.ts（算法逐行等价）**

```ts
import type { AxProperty, Candidate } from './inventory';

export interface AxNode {
  nodeId: string;
  backendDOMNodeId?: number;
  ignored?: boolean;
  role?: { type: string; value: string };
  name?: { value: string };
  childIds?: string[];
  properties?: AxProperty[];
}

const MAPPABLE_ROLES = new Set([
  'textbox', 'combobox', 'listbox', 'radio', 'checkbox', 'button',
  'link', 'menuitemcheckbox', 'menuitemradio', 'searchbox',
]);

// AXTree → 候选交互元素：role 可映射、未忽略、且无可映射交互后代的节点
// （按钮内常包 staticText 子节点，不能用"叶子"判定；列表类容器由最内层可交互节点代表）
export function reduceAxtree(nodes: AxNode[]): Candidate[] {
  const byId = new Map(nodes.filter(Boolean).map(n => [n.nodeId, n]));
  const mappable = (n?: AxNode): boolean =>
    !!n && !n.ignored && n.role?.type === 'role' && MAPPABLE_ROLES.has(n.role.value);
  const memo = new Map<string, boolean>();
  function hasMappableDesc(id: string): boolean {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    memo.set(id, false); // 防环
    const n = byId.get(id);
    let r = false;
    for (const c of n?.childIds ?? []) {
      if (mappable(byId.get(c)) || hasMappableDesc(c)) { r = true; break; }
    }
    memo.set(id, r);
    return r;
  }
  return nodes.filter(n =>
    n && !n.ignored &&
    n.role && n.role.type === 'role' && MAPPABLE_ROLES.has(n.role.value) &&
    !hasMappableDesc(n.nodeId),
  ).map(n => ({
    backendDOMNodeId: n.backendDOMNodeId ?? null,
    role: n.role!.value,
    name: n.name?.value ?? '',
    ignored: false,
    properties: Array.isArray(n.properties) ? n.properties : [],
  }));
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd extension && npm test -- reducer`
Expected: PASS

- [ ] **Step 5: 迁移 denoiser 测试（同 Step 1 机械改法，14 行旧实现 → 断言逐字保留）**

旧 `tests/denoiser.test.js` → `tests/denoiser.test.ts`，import 改为 `../lib/denoiser` 与 `../lib/constants`。测试数据对象需要补齐 `EnrichedCandidate` 必填字段时，建一个文件内 helper：

```ts
const cand = (over: Partial<EnrichedCandidate> = {}): EnrichedCandidate => ({
  backendDOMNodeId: null, role: 'textbox', name: 'n', ignored: false, properties: [],
  hints: { css_selector: null, aria_path: null, placeholder: null },
  constraints: { required: null, maxlength: null, pattern: null, input_type: null, disabled: false },
  visible: true, state: { disabled: false }, ...over,
});
```

- [ ] **Step 6: 实现 lib/denoiser.ts（算法逐行等价）**

```ts
import type { EnrichedCandidate } from './inventory';

const prop = (c: EnrichedCandidate, name: string): unknown =>
  c.properties.find(p => p.name === name)?.value?.value;

export function denoise(candidates: EnrichedCandidate[]): {
  kept: EnrichedCandidate[];
  dropped: (EnrichedCandidate & { reason: string })[];
} {
  const kept: EnrichedCandidate[] = [], dropped: (EnrichedCandidate & { reason: string })[] = [];
  for (const c of candidates) {
    const b = c.bounds ?? {};
    // 只有显式为 0 才判零尺寸；bounds 缺失表示未知（存疑不删）
    if (b.width === 0 || b.height === 0) { dropped.push({ ...c, reason: 'zero-size' }); continue; }
    if (c.visible === false || prop(c, 'hidden') === true) { dropped.push({ ...c, reason: 'hidden' }); continue; }
    const disabled = prop(c, 'disabled') === true;
    kept.push({ ...c, state: { disabled } });
  }
  return { kept, dropped };
}
```

- [ ] **Step 7: 全量测试 + 类型检查 + Commit**

Run: `cd extension && npm test && npm run compile`
Expected: PASS

```bash
git add extension/lib extension/tests && git commit -m "feat(extension): reducer/denoiser TS 化迁移（算法等价，测试迁移至 Vitest）"
```

---

### Task 4: 迁移 classifier + fold-groups（TS 化，interaction_type 收紧为 12 值 union）

**Files:**
- Create: `extension/lib/classifier.ts`, `extension/lib/fold-groups.ts`
- Test: `extension/tests/classifier.test.ts`, `extension/tests/fold-groups.test.ts`（断言不变迁移）

**Interfaces:**
- Consumes: `ClassifiedElement`、`Candidate`、`EnrichedCandidate`（Task 2）、`CONF_HIGH` / `CONF_THRESHOLD`（constants）
- Produces: `classify(candidates: Candidate[]): ClassifiedElement[]`；`splitByConfidence(classified: ClassifiedElement[]): [ClassifiedElement[], ClassifiedElement[], ClassifiedElement[]]`（返回 tuple）；`foldGroups(nodes: (Candidate & { name: string; role: string })[], opts?: { mode?: 'compact' | 'full'; minSiblings?: number }): { singles: Candidate[]; groups: FoldGroup[] }`，其中 `interface FoldGroup { kind: 'prefix' | 'suffix'; signature: string; role: string; representative: Candidate; memberCount: number; members: Candidate[] }`

- [ ] **Step 1: 迁移 classifier 测试**

旧 `tests/classifier.test.js`（31 行）→ `tests/classifier.test.ts`，机械改法同 Task 3 Step 1；import 改 `../lib/classifier`、`../lib/constants`。文件顶部的 `cand` helper 改为返回 `Candidate`：

```ts
const cand = (over: Partial<Candidate> = {}): Candidate => ({
  backendDOMNodeId: null, role: 'textbox', name: 'n', ignored: false, properties: [], ...over,
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd extension && npm test -- classifier`
Expected: FAIL

- [ ] **Step 3: 实现 lib/classifier.ts（算法逐行等价，映射表化消除 if 链重复——7 维 DRY）**

```ts
import { CONF_HIGH } from './constants';
import type { InteractionType } from './constants';
import type { Candidate, ClassifiedElement } from './inventory';

const propOf = (c: Candidate, name: string): unknown =>
  c.properties.find(p => p.name === name)?.value?.value;

const ROLE_TO_TYPE: Record<string, InteractionType> = {
  textbox: 'text_input',
  combobox: 'select',
  listbox: 'select',
  button: 'button',
  link: 'link',
  radio: 'radio',
  checkbox: 'checkbox',
};

export function classify(candidates: Candidate[]): ClassifiedElement[] {
  let tempId = 0;
  return candidates.map(c => {
    const t = c.constraints?.input_type;
    let interaction_type: InteractionType | null = null;
    let confidence = 0;
    if (t === 'file') { interaction_type = 'file_upload'; confidence = CONF_HIGH; }
    else if (t === 'date') { interaction_type = 'date_picker'; confidence = CONF_HIGH; }
    else if (c.role === 'textbox') {
      interaction_type = propOf(c, 'multiline') ? 'textarea' : 'text_input';
      confidence = CONF_HIGH;
    } else if (ROLE_TO_TYPE[c.role]) {
      interaction_type = ROLE_TO_TYPE[c.role]!;
      confidence = CONF_HIGH;
    }
    if (interaction_type === null && /页|分页/.test(c.name)) { interaction_type = 'pagination'; confidence = 0.6; }
    return { tempId: ++tempId, interaction_type, confidence, ...c } as ClassifiedElement;
  });
}

// ≥0.9 直进清单；<0.9 标低信心交 Skill；0=认不出 → unclassified
export function splitByConfidence(classified: ClassifiedElement[]): [
  ClassifiedElement[], ClassifiedElement[], ClassifiedElement[],
] {
  const sure: ClassifiedElement[] = [], review: ClassifiedElement[] = [], unclassified: ClassifiedElement[] = [];
  for (const c of classified) {
    if (!c.interaction_type || c.confidence === 0) unclassified.push(c);
    else if (c.confidence >= CONF_THRESHOLD) sure.push(c);
    else review.push(c);
  }
  return [sure, review, unclassified];
}
```

注意：`classify` 产出对象还带 `hints` 前缺省的 Candidate 字段——原实现就是"spread candidate + 追加字段"，`EnrichedCandidate` 必填字段在 background 管线中已由 enrich 补齐。类型上用 `as ClassifiedElement` 断言并在注释说明；若 `npm run compile` 报缺字段，改为入参类型 `Candidate & Partial<EnrichedCandidate>`、返回 `ClassifiedElement`，禁止放宽到 `any`。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd extension && npm test -- classifier`
Expected: PASS

- [ ] **Step 5: 迁移 fold-groups 测试**

旧 `tests/fold-groups.test.js`（85 行）→ `tests/fold-groups.test.ts`，机械改法同前；import 改 `../lib/fold-groups`。

- [ ] **Step 6: 实现 lib/fold-groups.ts（算法逐行等价）**

```ts
import type { Candidate } from './inventory';

export interface FoldGroup {
  kind: 'prefix' | 'suffix';
  signature: string;
  role: string;
  representative: Candidate;
  memberCount: number;
  members: Candidate[];
}

const NAME_PREFIX_MIN = 2;

function commonPrefix(names: string[]): string {
  if (names.length === 0) return '';
  let prefix = names[0]!;
  for (const n of names) {
    let i = 0;
    while (i < prefix.length && i < n.length && prefix[i] === n[i]) i++;
    prefix = prefix.slice(0, i);
    if (prefix.length < NAME_PREFIX_MIN) return '';
  }
  return prefix;
}

function lastToken(name?: string): string {
  const n = name ?? '';
  return n.includes(' ') ? n.split(' ').pop()! : n;
}

function makeGroup(kind: 'prefix' | 'suffix', signature: string, members: Candidate[]): FoldGroup {
  return {
    kind,
    signature,
    role: members[0]!.role,
    representative: members[0]!,
    memberCount: members.length,
    members,
  };
}

type FoldableNode = Candidate & { name: string; role: string };

export function foldGroups(
  nodes: FoldableNode[],
  { mode = 'compact', minSiblings = 5 }: { mode?: 'compact' | 'full'; minSiblings?: number } = {},
): { singles: FoldableNode[]; groups: FoldGroup[] } {
  if (mode === 'full' || !Array.isArray(nodes) || nodes.length === 0) {
    return { singles: Array.isArray(nodes) ? [...nodes] : [], groups: [] };
  }

  // 按父节点分组（null 也算一组）
  const byParent = new Map<string | null, FoldableNode[]>();
  for (const n of nodes) {
    const key = n.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(n);
  }

  const singles: FoldableNode[] = [], groups: FoldGroup[] = [];
  for (const siblings of byParent.values()) {
    if (siblings.length < minSiblings) { singles.push(...siblings); continue; }

    // 同父达标 → 按角色细分
    const byRole = new Map<string, FoldableNode[]>();
    for (const n of siblings) {
      if (!byRole.has(n.role)) byRole.set(n.role, []);
      byRole.get(n.role)!.push(n);
    }

    for (const bucket of byRole.values()) {
      if (bucket.length < minSiblings) { singles.push(...bucket); continue; }

      // 策略 1：公共前缀 —— 与簇代表名的公共前缀 ≥ NAME_PREFIX_MIN 即并入（贪心聚类）
      const clusters: { rep: string; arr: FoldableNode[] }[] = [];
      for (const n of bucket) {
        const name = n.name ?? '';
        let placed = false;
        for (const c of clusters) {
          if (commonPrefix([c.rep, name]).length >= NAME_PREFIX_MIN) { c.arr.push(n); placed = true; break; }
        }
        if (!placed) clusters.push({ rep: name, arr: [n] });
      }
      const leftovers: FoldableNode[] = [];
      for (const c of clusters) {
        // 组前缀按全体成员重算；重算后不合格（如混入异类）→ 降级进 leftovers，存疑不删
        const prefix = commonPrefix(c.arr.map(n => n.name ?? ''));
        if (prefix.length >= NAME_PREFIX_MIN && c.arr.length >= minSiblings) {
          groups.push(makeGroup('prefix', prefix, c.arr));
        } else {
          leftovers.push(...c.arr);
        }
      }

      // 策略 2（对前缀策略的漏网者）：尾 token 相同 → 等价类折叠
      const bySuffix = new Map<string, FoldableNode[]>();
      for (const n of leftovers) {
        const t = lastToken(n.name);
        if (!bySuffix.has(t)) bySuffix.set(t, []);
        bySuffix.get(t)!.push(n);
      }
      for (const [t, arr] of bySuffix) {
        if (arr.length >= minSiblings) {
          groups.push(makeGroup('suffix', t, arr));
        } else {
          singles.push(...arr);
        }
      }
    }
  }
  return { singles, groups };
}
```

- [ ] **Step 7: 全量测试 + 类型检查 + Commit**

Run: `cd extension && npm test && npm run compile`
Expected: PASS

```bash
git add extension/lib extension/tests && git commit -m "feat(extension): classifier/fold-groups TS 化迁移（interaction_type 收紧为 12 值 union）"
```

---

### Task 5: 迁移 exporter + selection + storage（IndexedDB 抽独立接口层）

**Files:**
- Create: `extension/lib/exporter.ts`, `extension/lib/selection.ts`, `extension/lib/storage.ts`
- Test: `extension/tests/exporter.test.ts`, `extension/tests/exporter-groups.test.ts`, `extension/tests/selection.test.ts`（断言不变迁移）

**Interfaces:**
- Consumes: `Inventory` / `InventoryElement` / `ClassifiedElement` / `InventoryMeta`（Task 2）
- Produces:
  - `buildInventory(args: { meta: InventoryMeta; sure: ClassifiedElement[]; review: ClassifiedElement[]; unclassified: ClassifiedElement[] }): Inventory`
  - `applySelections(elements: InventoryElement[], selections: Record<string, boolean> | Map<string, boolean>): InventoryElement[]`（selections 非对象时 `throw TypeError`，行为不变）
  - `reconcileElements(next: InventoryElement[], prev: InventoryElement[] | null | undefined): InventoryElement[]`
  - `saveScan(inventory: Inventory): Promise<boolean>` / `loadScan(sessionId: string): Promise<Inventory | null>`（由 storage.ts 提供，签名与旧版一致）
  - `interface ScanStorage { saveScan(inventory: Inventory): Promise<boolean>; loadScan(sessionId: string): Promise<Inventory | null> }` + `createIdbStorage(): ScanStorage`（M2 换存储的缝）

- [ ] **Step 1: 迁移三个测试文件**

旧 `tests/exporter.test.js`（19 行）、`tests/exporter-groups.test.js`（30 行）、`tests/selection.test.js`（34 行）→ 同名 `.ts`，机械改法同 Task 3 Step 1；import 改 `../lib/exporter`、`../lib/selection`。测试数据用 `as Inventory` / helper 补齐必填字段（同 Task 3 Step 5 的 `cand` 模式，但返回 `InventoryElement`）：

```ts
const el = (over: Partial<InventoryElement> = {}): InventoryElement => ({
  id: 'e001', interaction_type: 'button', label: '按钮',
  hints: { css_selector: null, aria_path: null, placeholder: null },
  constraints: { required: null, maxlength: null, pattern: null, input_type: null, disabled: false },
  visibility: 'visible', confidence: 0.95, selected: true, notes: '', ...over,
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd extension && npm test -- exporter selection`
Expected: FAIL

- [ ] **Step 3: 实现 lib/exporter.ts（算法逐行等价）**

```ts
import type { ClassifiedElement, Inventory, InventoryElement, InventoryMeta } from './inventory';

export function buildInventory({
  meta, sure, review, unclassified,
}: {
  meta: InventoryMeta;
  sure: ClassifiedElement[];
  review: ClassifiedElement[];
  unclassified: ClassifiedElement[];
}): Inventory {
  const elements: InventoryElement[] = [...sure, ...review].map((c, i) => {
    const group = c.__group
      ? { kind: c.__group.kind, signature: c.__group.signature, member_count: c.__group.member_count ?? c.__group.memberCount ?? 1 }
      : undefined;
    return {
      id: `e${String(i + 1).padStart(3, '0')}`,
      interaction_type: c.interaction_type,
      label: c.name ?? '',
      hints: { css_selector: c.hints?.css_selector ?? null, aria_path: c.hints?.aria_path ?? null, placeholder: c.hints?.placeholder ?? null },
      constraints: { required: c.constraints?.required ?? null, maxlength: c.constraints?.maxlength ?? null, pattern: c.constraints?.pattern ?? null, input_type: c.constraints?.input_type ?? null, disabled: c.state?.disabled ?? false },
      visibility: c.visible === false ? 'hidden' : 'visible',
      confidence: c.confidence,
      selected: true,
      ...(group ? { group } : {}),
      notes: group ? `同类折叠：${group.member_count} 个同名近似元素合并由此代表` : '',
    };
  });
  return {
    schema_version: '0.1',
    meta: { ...meta, captured_at: new Date().toISOString() },
    elements,
    unclassified: (unclassified ?? []).map(c => ({ tempId: c.tempId, role: c.role, name: c.name ?? '' })),
  };
}
```

- [ ] **Step 4: 实现 lib/selection.ts（纯函数部分）**

```ts
import type { InventoryElement } from './inventory';

export type Selections = Record<string, boolean> | Map<string, boolean>;

function selectionHas(selections: Selections, id: string): boolean {
  return selections instanceof Map
    ? selections.has(id)
    : Object.prototype.hasOwnProperty.call(selections, id);
}
function selectionGet(selections: Selections, id: string): boolean | undefined {
  return selections instanceof Map ? selections.get(id) : selections[id];
}

export function applySelections(elements: InventoryElement[], selections: Selections): InventoryElement[] {
  if (selections == null || typeof selections !== 'object') {
    throw new TypeError('selections 必须是对象或 Map');
  }
  return elements.map(el =>
    selectionHas(selections, el.id) ? { ...el, selected: Boolean(selectionGet(selections, el.id)) } : el,
  );
}

// 新清单 vs 上次已勾选清单：同 id 继承勾选；新元素默认 true（存疑不删）
export function reconcileElements(
  next: InventoryElement[],
  prev: InventoryElement[] | null | undefined,
): InventoryElement[] {
  if (!Array.isArray(prev) || prev.length === 0) {
    return (next ?? []).map(el => ({ ...el, selected: true }));
  }
  const prevSel = new Map(
    prev.filter(e => e && e.id != null).map(e => [e.id, Boolean(e.selected)]),
  );
  return (next ?? []).map(el => ({
    ...el,
    selected: prevSel.has(el.id) ? prevSel.get(el.id)! : true,
  }));
}
```

- [ ] **Step 5: 实现 lib/storage.ts（IndexedDB 封装 + 接口缝）**

```ts
import type { Inventory } from './inventory';

// 存储接口：M1 只实现 IndexedDB；M2 可替换（如 chrome.storage / 远端托管）
export interface ScanStorage {
  saveScan(inventory: Inventory): Promise<boolean>;
  loadScan(sessionId: string): Promise<Inventory | null>;
}

const DB_NAME = 'casefront';
const DB_VERSION = 2; // 目录句柄存储已废弃；库结构维持 v2 不再升级，旧库残留的空 store 无害
const STORE_SCANS = 'scans'; // keyPath: session_id

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SCANS)) {
        db.createObjectStore(STORE_SCANS, { keyPath: 'session_id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function createIdbStorage(): ScanStorage {
  return {
    async saveScan(inventory) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SCANS, 'readwrite');
        tx.objectStore(STORE_SCANS).put({ ...inventory, saved_at: new Date().toISOString() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    },
    async loadScan(sessionId) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SCANS, 'readonly');
        const req = tx.objectStore(STORE_SCANS).get(sessionId);
        req.onsuccess = () => resolve((req.result as Inventory | undefined) ?? null);
        req.onerror = () => reject(req.error);
      });
    },
  };
}

// 默认实例：popup 与 SW 同源共享同一个库（与旧版行为一致）
export const storage: ScanStorage = createIdbStorage();
export const saveScan = storage.saveScan.bind(storage);
export const loadScan = storage.loadScan.bind(storage);
```

- [ ] **Step 6: 全量测试 + 类型检查 + Commit**

Run: `cd extension && npm test && npm run compile`
Expected: PASS

```bash
git add extension/lib extension/tests && git commit -m "feat(extension): exporter/selection/storage TS 化迁移（IndexedDB 抽 ScanStorage 接口）"
```

---

### Task 6: 消息协议 + CDP 类型 + background 迁移

**Files:**
- Create: `extension/lib/messages.ts`, `extension/lib/cdp-types.ts`, `extension/entrypoints/background.ts`
- Test: `extension/tests/messages.test.ts`（新增：消息 union 的类型收窄行为用例）

**Interfaces:**
- Consumes: `Inventory`、管线函数（Tasks 3-5）、`AxNode`（Task 3）
- Produces:
  - `type PopupRequest = ScanRequest | GetLastScanRequest | DownloadExportRequest`（discriminated by `type: 'SCAN' | 'GET_LAST_SCAN' | 'DOWNLOAD_EXPORT'`）
  - `type ScanResponse = { ok: true; session_id: string; count: number; folded_groups: number } | { ok: false; error: string }`
  - `type GetLastScanResponse = { ok: true; inventory: Inventory | null }`
  - `type DownloadExportResponse = { ok: true; via: 'download'; path: string; absolute_path: string | null; count: number } | { ok: false; error: string }`
  - cdp-types: `interface ResolveNodeResult { object?: { objectId?: string } }`、`interface CallFunctionOnResult { result?: { value?: Record<string, unknown> } }`、`type DebuggerSend = <T>(method: string, params?: object) => Promise<T>`

- [ ] **Step 1: 写 messages 类型 + 失败测试**

`extension/lib/messages.ts`：

```ts
import type { Inventory } from './inventory';

export interface ScanRequest { type: 'SCAN'; mode: 'compact' | 'full' }
export interface GetLastScanRequest { type: 'GET_LAST_SCAN' }
export interface DownloadExportRequest { type: 'DOWNLOAD_EXPORT'; inventory: Inventory }

export type PopupRequest = ScanRequest | GetLastScanRequest | DownloadExportRequest;

export type ScanResponse =
  | { ok: true; session_id: string; count: number; folded_groups: number }
  | { ok: false; error: string };

export type GetLastScanResponse = { ok: true; inventory: Inventory | null };

export type DownloadExportResponse =
  | { ok: true; via: 'download'; path: string; absolute_path: string | null; count: number }
  | { ok: false; error: string };
```

`extension/tests/messages.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import type { PopupRequest } from '../lib/messages';

describe('消息协议', () => {
  it('discriminated union 收窄正确', () => {
    const req: PopupRequest = { type: 'SCAN', mode: 'compact' };
    if (req.type === 'SCAN') {
      expect(req.mode).toBe('compact');
    } else {
      throw new Error('SCAN 应收窄到 ScanRequest');
    }
  });
});
```

Run: `cd extension && npm test -- messages`
Expected: PASS（纯类型模块，测试保运行期不回归）

- [ ] **Step 2: 写 lib/cdp-types.ts**

```ts
import type { AxNode } from './reducer';

export interface ResolveNodeResult {
  object?: { objectId?: string };
}

export interface CallFunctionOnResult {
  result?: { value?: Record<string, unknown> };
}

export type DebuggerSend = <T>(method: string, params?: object) => Promise<T>;

// Accessibility.getFullAXTree 响应（实际用到的最小子集）
export interface GetFullAXTreeResult {
  nodes: AxNode[];
}
```

- [ ] **Step 3: 迁移 background（WXT defineBackground，逻辑逐行等价）**

`extension/entrypoints/background.ts`：

```ts
import { exportBrowserPath as _unused } from 'wxt/browser'; // ← 不要这行，见下方真实代码
```

（上为占位示意——真实文件如下，无该 import。）

```ts
import { buildInventory } from '@/lib/exporter';
import { classify, splitByConfidence } from '@/lib/classifier';
import { denoise } from '@/lib/denoiser';
import { foldGroups } from '@/lib/fold-groups';
import { reduceAxtree, type AxNode } from '@/lib/reducer';
import { loadScan, saveScan } from '@/lib/storage';
import { reconcileElements } from '@/lib/selection';
import type { EnrichedCandidate } from '@/lib/inventory';
import type { DebuggerSend, GetFullAXTreeResult, CallFunctionOnResult, ResolveNodeResult } from '@/lib/cdp-types';
import type { DownloadExportResponse, GetLastScanResponse, PopupRequest, ScanResponse } from '@/lib/messages';

export default defineBackground(() => {
  const DEBUGGER_PROTO = '1.3';
  let lastInventory: Parameters<GetLastScanResponseHandler>['inventory'] = null; // 见下：直接用 Inventory | null

  chrome.runtime.onMessage.addListener((msg: PopupRequest, _sender, sendResponse) => {
    if (msg?.type === 'SCAN') {
      scanActiveTab(msg.mode === 'full' ? 'full' : 'compact')
        .then(sendResponse)
        .catch(e => sendResponse({ ok: false, error: String((e as Error)?.message ?? e) }));
      return true; // 异步 sendResponse
    }
    if (msg?.type === 'GET_LAST_SCAN') {
      sendResponse({ ok: true, inventory: lastInventory } satisfies GetLastScanResponse);
      return false;
    }
    if (msg?.type === 'DOWNLOAD_EXPORT') {
      downloadExport(msg.inventory)
        .then(sendResponse)
        .catch(e => sendResponse({ ok: false, error: String((e as Error)?.message ?? e) }));
      return true;
    }
    return false;
  });
  // ……（scanActiveTab / enrich / downloadExport / resolveDownloadPath / makeSessionId：
  //      从旧 src/background.js 逐行等价迁移，仅做三处类型化改动，见 Task 内「类型化改动清单」）
});
```

实现要求（写代码的人照此办，不重新设计）：
1. `scanActiveTab(mode: 'compact' | 'full'): Promise<ScanResponse-ok>` 内部与旧版一致：`chrome.tabs.query` → `chrome.debugger.attach(target, '1.3')`（失败抛 "CDP attach 失败（若开着 DevTools，请关闭后重试）：…"; `finally` 必 `detach`）→ `Accessibility.getFullAXTree`（响应 `as GetFullAXTreeResult`）→ `reduceAxtree` → 逐个 `enrich` → `denoise` → `foldGroups(kept, { mode })` → 折叠组代表加 `__group: { kind, signature, member_count: g.memberCount }` → `classify` + `splitByConfidence` → `buildInventory` → 同名会话 `loadScan`/`reconcileElements` 继承勾选 → `saveScan` → `lastInventory = inventory` → 返回 `{ ok: true, session_id, count, folded_groups }`
2. `lastInventory` 类型为 `Inventory | null`（import type { Inventory } from '@/lib/inventory'）
3. `enrich(candidate, send: DebuggerSend)`：与旧版一致——`DOM.resolveNode`（`as ResolveNodeResult`）→ `Runtime.callFunctionOn`（`as CallFunctionOnResult`），函数声明字符串逐字保留；单元素失败 try/catch 诚实降级；`enrichSeq` 模块级计数每次扫描重置
4. `downloadExport(inventory: Inventory): Promise<DownloadExportResponse-ok>`：data URL + `chrome.downloads.download` + `resolveDownloadPath`（8s 轮询 250ms）逐行等价；`makeSessionId(tab)` 逐字保留（日期 + 标题前 20 字符替换非法字符）
5. `sendResponse` 回调参数类型：MV3 的 `chrome.runtime.onMessage` 类型自带；若 tsc 对 `sendResponse({ ok: false, error })` 报不匹配，把 handler 的响应参数标注为对应 `*Response` union（用消息类型收窄判断，不放宽 any）

- [ ] **Step 4: 类型检查与构建**

Run: `cd extension && npm run compile && npm run build`
Expected: 均成功；`.output/chrome-mv3/background.js` 存在

- [ ] **Step 5: 全量测试 + Commit**

Run: `cd extension && npm test`
Expected: PASS

```bash
git add extension && git commit -m "feat(extension): background 迁移至 WXT entrypoint（消息协议与 CDP 类型化）"
```

---

### Task 7: React + Tailwind popup（组件化 + 组件测试）

**Files:**
- Create: `extension/entrypoints/popup/style.css`, `extension/entrypoints/popup/App.tsx`（替换骨架）, `extension/entrypoints/popup/components/Icon.tsx`, `extension/entrypoints/popup/components/StatusPanel.tsx`, `extension/entrypoints/popup/components/ElementList.tsx`, `extension/entrypoints/popup/components/ElementItem.tsx`, `extension/entrypoints/popup/components/ExportBar.tsx`
- Test: `extension/tests/popup-app.test.tsx`

**Interfaces:**
- Consumes: `PopupRequest` / `*Response`（Task 6）、`Inventory` / `InventoryElement`（Task 2）、`applySelections` / `saveScan`（Task 5）
- Produces（组件 props，测试与后续任务依赖）:
  - `<Icon name="idle" | "load" | "ok" | "err" | "warn" />`
  - `<StatusPanel kind={StatusKind} text={string} sub={string} />`
  - `<ElementList elements={InventoryElement[]} isPending={(id) => boolean} onToggle={(id, checked) => void} />`
  - `<ExportBar onExport={() => Promise<void>} exporting={boolean} exportPath={string | null} />`
  - App 内状态机：`type ScanPhase = 'idle' | 'loading' | 'ok' | 'err' | 'warn'`，`useReducer` 管理 `{ phase, statusText, statusSub, view, session, pending, exportPath }`

- [ ] **Step 1: style.css —— Tailwind v4 + 现有 CSS 变量做 token**

```css
@import "tailwindcss";

/* 现版色板原样迁移：浅色/深色跟随系统（prefers-color-scheme），Tailwind token 经 @theme inline 映射 */
:root {
  --bg: #f5f5f7; --card: #ffffff; --text: #1d1d1f; --text-2: #6e6e73; --text-3: #aeaeb2;
  --sep: rgba(60, 60, 67, 0.10);
  --blue: #007aff; --blue-hover: #0071e3; --blue-press: #0062cc;
  --green: #34c759; --green-bg: rgba(52, 199, 89, 0.12);
  --red: #ff3b30; --orange: #ff9500;
  --fill: rgba(120, 120, 128, 0.10); --fill-hover: rgba(120, 120, 128, 0.16); --fill-press: rgba(120, 120, 128, 0.22);
  --radius: 14px;
  --mono: "SF Mono", ui-monospace, Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1c1c1e; --card: #2c2c2e; --text: #f5f5f7; --text-2: #98989d; --text-3: #636366;
    --sep: rgba(84, 84, 88, 0.45);
    --blue: #0a84ff; --blue-hover: #3395ff; --blue-press: #409cff;
    --green: #30d158; --green-bg: rgba(48, 209, 88, 0.16);
    --red: #ff453a; --orange: #ff9f0a;
    --fill: rgba(120, 120, 128, 0.20); --fill-hover: rgba(120, 120, 128, 0.28); --fill-press: rgba(120, 120, 128, 0.36);
  }
}
@theme inline {
  --color-bg: var(--bg);
  --color-card: var(--card);
  --color-text: var(--text);
  --color-text-2: var(--text-2);
  --color-text-3: var(--text-3);
  --color-sep: var(--sep);
  --color-blue: var(--blue);
  --color-blue-hover: var(--blue-hover);
  --color-blue-press: var(--blue-press);
  --color-green: var(--green);
  --color-green-bg: var(--green-bg);
  --color-red: var(--red);
  --color-orange: var(--orange);
  --color-fill: var(--fill);
  --color-fill-hover: var(--fill-hover);
  --color-fill-press: var(--fill-press);
  --font-mono: var(--mono);
}

/* Tailwind 覆盖不到的基元：body 宽度/字体、自定义 checkbox 勾、旋转动画、滚动条 */
body {
  width: 380px; margin: 0; padding: 14px;
  background: var(--bg); color: var(--text);
  font: 13px/1.5 -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}
@keyframes spin { to { transform: rotate(360deg); } }
.animate-spin-slow { animation: spin 0.85s linear infinite; }
@keyframes fade-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
.animate-view { animation: fade-in 200ms cubic-bezier(0.25, 0.8, 0.35, 1); }
.custom-cb { appearance: none; width: 18px; height: 18px; margin: 0; flex: none;
  border: 1.5px solid var(--text-3); border-radius: 5.5px; cursor: pointer; position: relative;
  transition: background-color 140ms ease, border-color 140ms ease; }
.custom-cb:checked { background: var(--blue); border-color: var(--blue); }
.custom-cb:checked::after { content: ""; position: absolute; left: 5px; top: 1.5px;
  width: 4.5px; height: 8.5px; border: solid #fff; border-width: 0 1.8px 1.8px 0; transform: rotate(45deg); }
.custom-cb:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
.list-scroll::-webkit-scrollbar { width: 8px; }
.list-scroll::-webkit-scrollbar-thumb { background: var(--fill-hover); border-radius: 4px; border: 2px solid transparent; background-clip: content-box; }
```

- [ ] **Step 2: 组件实现（5 个文件，视觉规格对照旧 popup.html 逐区块迁移）**

`components/Icon.tsx`：

```tsx
const PATHS: Record<string, { stroke: string; d: string[]; extra?: string }> = {
  idle: { stroke: 'var(--text-3)', d: ['M12 11.3v4.9'], extra: 'M12 12a8.6 8.6 0 1 0-.01 0 M12 7.9a1.1 1.1 0 1 0 0 .01' },
  // ↑ 复杂 icon 用多 path；实现时直接把旧 popup.js ICONS 里 5 段 <svg> 标记逐字搬来，
  //   用 dangerouslySetInnerHTML 或 JSX 拆 path 均可，视觉必须一致。
};

export type IconName = 'idle' | 'load' | 'ok' | 'err' | 'warn';

export default function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  const svg = ICONS[name]; // ICONS: 与旧 popup.js 第 27-33 行逐字相同的 5 段 svg 字符串
  const spinning = name === 'load';
  return (
    <span
      className={`inline-block size-4 ${className}`}
      dangerouslySetInnerHTML={{ __html: spinning ? svg.replace('<svg ', '<svg class="animate-spin-slow" ') : svg }}
    />
  );
}

const ICONS: Record<IconName, string> = {
  idle: '<svg viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.6"/><path d="M12 11.3v4.9"/><circle cx="12" cy="7.9" r="1.1" fill="var(--text-3)" stroke="none"/></svg>',
  load: '<svg viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2.2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-9-9"/></svg>',
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.6"/><path d="m8.4 12.4 2.4 2.4 4.8-5.2"/></svg>',
  err: '<svg viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="8.6"/><path d="M12 8v5M12 15.8v.2"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.2 2.8 20h18.4L12 4.2z"/><path d="M12 10.2v4M12 17v.2"/></svg>',
};
```

（ICONS 字符串来自旧 `popup.js:27-33`，逐字迁移；上方 PATHS 草稿删除，只留 ICONS 方案。）

`components/StatusPanel.tsx`：

```tsx
import Icon, { type IconName } from './Icon';

export type StatusKind = IconName;

export default function StatusPanel({ kind, text, sub }: { kind: StatusKind; text: string; sub: string }) {
  return (
    <div className="mt-3 rounded-[11px] bg-fill px-3 py-2.5">
      <div className="flex items-start gap-2">
        <span className="mt-[1.5px]"><Icon name={kind} /></span>
        <div className="min-w-0 flex-1 text-[12.5px] font-medium">
          {text}
          {sub ? <span className="mt-[3px] block text-xs font-normal text-text-2">{sub}</span> : null}
        </div>
      </div>
      {/* 路径行由 ExportBar 放在 StatusPanel 之后渲染（保持旧 DOM 顺序），见 App.tsx */}
    </div>
  );
}
```

`components/ElementItem.tsx`：

```tsx
import type { InventoryElement } from '@/lib/inventory';

export default function ElementItem({ el, checked, onToggle }: {
  el: InventoryElement; checked: boolean; onToggle: (id: string, checked: boolean) => void;
}) {
  const n = Number(el.group?.member_count) || 0;
  return (
    <li className="flex items-center gap-2.5 px-3 py-[9px] hover:bg-fill [&+&]:border-t [&+&]:border-sep">
      <input
        type="checkbox"
        className="custom-cb"
        checked={checked}
        data-id={el.id}
        aria-label={el.label}
        onChange={e => onToggle(el.id, e.target.checked)}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] break-all">{el.label || el.hints?.placeholder || '(未命名)'}</div>
        <div className="mt-[3px] flex flex-wrap gap-[5px]">
          {el.interaction_type ? (
            <span className="rounded-[5px] bg-fill px-1.5 py-[3px] text-[10.5px] leading-none text-text-2">{el.interaction_type}</span>
          ) : null}
          {el.group ? (
            <span
              title={`同类折叠组：${el.group.signature}`}
              className="inline-flex items-center gap-0.5 rounded-[5px] bg-green-bg pr-1.5 pl-[6px] py-[3px] text-[10.5px] leading-none text-green"
            >
              <svg viewBox="0 0 10 10" aria-hidden="true" className="block size-[5.5px] opacity-80">
                <path d="M2.2 2.2l5.6 5.6M7.8 2.2l-5.6 5.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
              </svg>
              <b className="text-[9.5px] font-semibold tracking-[0.1px]">{n}</b>
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}
```

`components/ElementList.tsx`：

```tsx
import type { InventoryElement } from '@/lib/inventory';
import ElementItem from './ElementItem';

export default function ElementList({ elements, isPending, onToggle }: {
  elements: InventoryElement[];
  isPending: (id: string) => boolean;
  onToggle: (id: string, checked: boolean) => void;
}) {
  return (
    <ul className="list-scroll m-0 max-h-[300px] overflow-y-auto rounded-[14px] border-[0.5px] border-sep bg-card p-0 shadow-sm"
        style={{ listStyle: 'none' }}>
      {elements.map(el => (
        <ElementItem key={el.id} el={el} checked={isPending(el.id)} onToggle={onToggle} />
      ))}
    </ul>
  );
}
```

`components/ExportBar.tsx`：

```tsx
import { useRef, useState } from 'react';

export default function ExportBar({ onExport, exporting, exportPath }: {
  onExport: () => Promise<void>;
  exporting: boolean;
  exportPath: string | null;
}) {
  const [copied, setCopied] = useState<'none' | 'ok' | 'fail'>('none');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  async function copyPath() {
    if (!exportPath) return;
    let ok = false;
    try {
      await navigator.clipboard.writeText(exportPath);
      ok = true;
    } catch {
      // 剪贴板 API 不可用时回落 execCommand（与旧版一致）
      const ta = document.createElement('textarea');
      ta.value = exportPath;
      ta.hidden = true;
      document.body.appendChild(ta);
      ta.select();
      try { ok = document.execCommand('copy'); } catch { /* 忽略 */ }
      ta.remove();
    }
    setCopied(ok ? 'ok' : 'fail');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied('none'), 1500);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onExport}
        disabled={exporting}
        className="inline-flex h-[34px] items-center justify-center gap-1.5 rounded-[10px] bg-blue px-3.5 font-semibold text-white transition-all active:scale-[0.97] disabled:opacity-40"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-[15px] flex-none">
          <path d="M12 3.5v11M12 14.5 7.5 10M12 14.5 16.5 10" />
          <path d="M4 16.5v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        {exporting ? '导出中…' : '保存并导出'}
      </button>
      {exportPath ? (
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[9px] border-[0.5px] border-sep bg-card px-2 py-[7px]">
          <span className="min-w-0 flex-1 break-all font-mono text-[10.5px] leading-[1.45] text-text-2">{exportPath}</span>
          <button
            onClick={copyPath}
            className={`h-[26px] flex-none rounded-[7px] px-2.5 text-xs ${copied === 'ok' ? 'bg-green-bg text-green' : 'bg-fill text-blue'}`}
          >
            {copied === 'ok' ? '已复制' : copied === 'fail' ? '复制失败' : '复制路径'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
```

`App.tsx`（替换 Task 1 骨架；扫描视图头部/模式选择器/提示文案一并迁入，视觉对照旧 popup.html view-scan 区块）：

```tsx
import { useCallback, useEffect, useReducer } from 'react';
import type { Inventory } from '@/lib/inventory';
import { applySelections } from '@/lib/selection';
import { saveScan } from '@/lib/storage';
import type { DownloadExportResponse, GetLastScanResponse, PopupRequest, ScanResponse } from '@/lib/messages';
import StatusPanel, { type StatusKind } from './components/StatusPanel';
import ElementList from './components/ElementList';
import ExportBar from './components/ExportBar';

type View = 'scan' | 'review';

interface State {
  view: View;
  status: { kind: StatusKind; text: string; sub: string };
  session: Inventory | null;
  pending: Record<string, boolean>;
  exportPath: string | null;
}

type Action =
  | { type: 'RESET_STATUS' }
  | { type: 'STATUS'; kind: StatusKind; text: string; sub?: string }
  | { type: 'SESSION'; session: Inventory }
  | { type: 'TOGGLE'; id: string; checked: boolean }
  | { type: 'SET_ALL'; checked: boolean }
  | { type: 'EXPORT_PATH'; path: string | null }
  | { type: 'VIEW'; view: View };

const initialState: State = {
  view: 'scan',
  status: { kind: 'idle', text: '就绪', sub: '扫描当前页面，生成可勾选的交互元素清单' },
  session: null,
  pending: {},
  exportPath: null,
};

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'RESET_STATUS': return { ...s, status: initialState.status };
    case 'STATUS': return { ...s, status: { kind: a.kind, text: a.text, sub: a.sub ?? '' } };
    case 'SESSION': return { ...s, session: a.session, pending: {} };
    case 'TOGGLE': return { ...s, pending: { ...s.pending, [a.id]: a.checked } };
    case 'SET_ALL': {
      const pending: Record<string, boolean> = {};
      for (const el of s.session?.elements ?? []) pending[el.id] = a.checked;
      return { ...s, pending };
    }
    case 'EXPORT_PATH': return { ...s, exportPath: a.path };
    case 'VIEW': return { ...s, view: a.view };
  }
}

function send<T>(req: PopupRequest): Promise<T> {
  return chrome.runtime.sendMessage(req) as Promise<T>;
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const isChecked = useCallback(
    (id: string) => state.pending[id] ?? (state.session?.elements.find(e => e.id === id)?.selected !== false),
    [state.pending, state.session],
  );
  const selectedCount = (state.session?.elements ?? []).filter(el => isChecked(el.id)).length;

  // popup 每次打开重置到 scan 视图（与旧版一致：无恢复逻辑）
  useEffect(() => { dispatch({ type: 'RESET_STATUS' }); }, []);

  async function scan(mode: 'compact' | 'full') {
    dispatch({ type: 'STATUS', kind: 'load', text: '采集中…', sub: mode === 'compact' ? '精简模式：同类元素折叠为一组代表' : '完整模式：全量清单，不折叠' });
    let res: ScanResponse;
    try { res = await send<ScanResponse>({ type: 'SCAN', mode }); }
    catch (e) { dispatch({ type: 'STATUS', kind: 'err', text: '扫描失败：' + (e as Error).message }); return; }
    if (!res.ok) {
      dispatch({ type: 'STATUS', kind: 'err', text: res.error, sub: 'DevTools 开着会占用调试通道，关闭后重试' });
      return;
    }
    dispatch({ type: 'STATUS', kind: 'ok', text: `已采集 ${res.count} 个交互元素`, sub: res.folded_groups > 0 ? `同类折叠：${res.folded_groups} 组，进入勾选确认` : '进入勾选确认' });
    const snap = await send<GetLastScanResponse>({ type: 'GET_LAST_SCAN' });
    if (snap?.ok && snap.inventory) {
      dispatch({ type: 'SESSION', session: snap.inventory });
      dispatch({ type: 'VIEW', view: 'review' });
    }
  }

  async function exportInventory() {
    if (!state.session) return;
    dispatch({ type: 'EXPORT_PATH', path: null });
    try {
      const sessionId = state.session.meta?.session_id ?? state.session.session_id;
      const elements = applySelections(state.session.elements, state.pending);
      const inventory: Inventory = { ...state.session, elements, session_id: sessionId };
      inventory.meta = { ...state.session.meta, session_id: sessionId, exported_at: new Date().toISOString() };
      try { await saveScan(inventory); } catch { /* 快照持久化失败不阻塞导出 */ }
      const res = await send<DownloadExportResponse>({ type: 'DOWNLOAD_EXPORT', inventory });
      if (!res?.ok) { dispatch({ type: 'STATUS', kind: 'err', text: '导出失败：' + (res?.error ?? '未知错误') }); return; }
      if (res.absolute_path) {
        dispatch({ type: 'EXPORT_PATH', path: res.absolute_path });
        dispatch({ type: 'STATUS', kind: 'ok', text: '已导出（selected 已写回清单）', sub: '在 Comate 中 @ 该文件生成用例' });
      } else {
        dispatch({ type: 'STATUS', kind: 'warn', text: '已导出（未解析到落盘绝对路径）', sub: res.path });
      }
      dispatch({ type: 'VIEW', view: 'scan' });
    } finally {
      /* 按钮 exporting 状态复位由 StatusPanel 驱动 */
    }
  }

  if (state.view === 'review') {
    return (
      <div className="animate-view">
        <div className="mb-3 flex items-center gap-2">
          <button onClick={() => { dispatch({ type: 'RESET_STATUS' }); dispatch({ type: 'VIEW', view: 'scan' }); }}
                  className="inline-flex h-7 items-center gap-1 rounded-lg bg-fill px-2.5 text-xs text-blue hover:bg-fill-hover">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-3"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>
            重扫
          </button>
          <h3 className="flex-1 text-[15px] font-semibold tracking-[-0.2px]">勾选纳入用例生成的元素</h3>
        </div>
        <div className="mb-2.5 flex items-center gap-2">
          <button onClick={() => dispatch({ type: 'SET_ALL', checked: true })} className="h-7 flex-1 rounded-lg bg-fill px-2.5 text-xs text-blue hover:bg-fill-hover">全选</button>
          <button onClick={() => dispatch({ type: 'SET_ALL', checked: false })} className="h-7 flex-1 rounded-lg bg-fill px-2.5 text-xs text-blue hover:bg-fill-hover">全不选</button>
          <ExportBar onExport={exportInventory} exporting={false} exportPath={null} />
        </div>
        <div className="mx-0.5 mb-2 text-xs text-text-2">
          已选 <b className="font-semibold text-text">{selectedCount}</b> / {(state.session?.elements ?? []).length}
        </div>
        <ElementList elements={state.session?.elements ?? []} isPending={isChecked}
                     onToggle={(id, checked) => dispatch({ type: 'TOGGLE', id, checked })} />
      </div>
    );
  }

  return (
    <div className="animate-view">
      {/* 卡片：logo + 标题 + 模式选择 + 扫描按钮 + 状态区；样式对照旧 popup.html 头部区块 */}
      <div className="rounded-[14px] border-[0.5px] border-sep bg-card p-3.5 shadow-sm">
        {/* 头部（logo svg 逐字搬旧 popup.html:216-219） */}
        <div className="flex items-center gap-[11px]">…</div>
        <div className="mt-[13px] flex items-center gap-2">
          <select defaultValue="compact" id="mode"
                  className="h-[34px] flex-1 cursor-pointer rounded-[10px] border-none bg-fill px-3 pr-7 font-[inherit] text-text hover:bg-fill-hover">
            <option value="compact">精简（同类折叠）</option>
            <option value="full">完整（全量）</option>
          </select>
          <button onClick={() => scan((document.getElementById('mode') as HTMLSelectElement).value === 'full' ? 'full' : 'compact')}
                  className="inline-flex h-[34px] items-center gap-1.5 rounded-[10px] bg-blue px-3.5 font-semibold text-white hover:bg-blue-hover active:bg-blue-press active:scale-[0.97]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-[15px]"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M8.5 12h7"/></svg>
            扫描此页
          </button>
        </div>
        <StatusPanel kind={state.status.kind} text={state.status.text} sub={state.status.sub} />
        {state.exportPath ? <ExportBar onExport={exportInventory} exporting={false} exportPath={state.exportPath} /> : null}
      </div>
      <div className="mt-2.5 text-[11.5px] leading-[1.55] text-text-3">
        <span className="font-medium text-text-2">精简模式</span>：5 个以上同类元素折叠为一组；<span className="font-medium text-text-2">完整模式</span>全量导出。<br />
        扫描后进入勾选视图，可按需收缩用例范围。
      </div>
    </div>
  );
}
```

实现者注意（非自由发挥空间）：
- 「…」头部区块：logo SVG + "CaseFront" + 副标题，样式对照旧 popup.html:213-225 逐项迁移
- **导出成功后的路径行**：旧版是路径行出现在 scan 视图状态区内（popup.html:244-253）——App 里 `state.exportPath` 存在时在 StatusPanel 下方渲染路径行 + 复制按钮（复用 ExportBar 的 copyPath 逻辑：把 copyPath 抽成 `lib/clipboard.ts` 导出 `copyText(text: string): Promise<boolean>`，ExportBar 与路径行共用——DRY）
- review 视图里 ExportBar 只作为导出按钮使用（不显示路径行）；`exporting` 状态用 State 里加 `exporting: boolean` 管理，开始导出置 true、finally 复位
- 模式选择器下拉箭头背景图（popup.html:112）用任意实现保留视觉

- [ ] **Step 3: 组件测试（Vitest + jsdom + RTL，mock chrome API）**

`extension/tests/popup-app.test.tsx`：

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import App from '../entrypoints/popup/App';
import type { Inventory } from '../lib/inventory';

const session: Inventory = {
  schema_version: '0.1',
  session_id: '2026-09-19_demo',
  meta: { page_url: 'https://x', page_title: 'demo', session_id: '2026-09-19_demo', plugin_version: '0.3.0', scan_mode: 'compact' },
  elements: [
    { id: 'e001', interaction_type: 'text_input', label: '用户名', hints: { css_selector: null, aria_path: null, placeholder: null }, constraints: { required: null, maxlength: null, pattern: null, input_type: null, disabled: false }, visibility: 'visible', confidence: 0.95, selected: true, notes: '' },
    { id: 'e002', interaction_type: 'button', label: '提交', hints: { css_selector: null, aria_path: null, placeholder: null }, constraints: { required: null, maxlength: null, pattern: null, input_type: null, disabled: false }, visibility: 'visible', confidence: 0.95, selected: true, notes: '' },
  ],
  unclassified: [],
};

const sendMessage = vi.fn();

beforeEach(() => {
  vi.stubGlobal('chrome', { runtime: { sendMessage: sendMessage } });
  sendMessage.mockReset();
});

describe('popup App', () => {
  it('扫描成功后进入勾选视图，勾选计数正确', async () => {
    sendMessage.mockResolvedValueOnce({ ok: true, session_id: 's', count: 2, folded_groups: 0 })
      .mockResolvedValueOnce({ ok: true, inventory: session });
    render(<App />);
    fireEvent.click(screen.getByText('扫描此页'));
    expect(await screen.findByText('勾选纳入用例生成的元素')).toBeInTheDocument();
    expect(screen.getByText('已选')).toHaveTextContent('已选 2 / 2');
  });

  it('全不选后计数为 0，单项勾选恢复', async () => {
    sendMessage.mockResolvedValueOnce({ ok: true, session_id: 's', count: 2, folded_groups: 0 })
      .mockResolvedValueOnce({ ok: true, inventory: session });
    render(<App />);
    fireEvent.click(screen.getByText('扫描此页'));
    await screen.findByText('勾选纳入用例生成的元素');
    fireEvent.click(screen.getByText('全不选'));
    expect(screen.getByText('已选 0 / 2')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('用户名'));
    expect(screen.getByText('已选 1 / 2')).toBeInTheDocument();
  });

  it('复制路径：clipboard 失败回落 execCommand', async () => {
    // 直接测 lib/clipboard.ts（DRY 抽取后的单元）
    const { copyText } = await import('../lib/clipboard');
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('no')) } });
    const exec = vi.fn().mockReturnValue(true);
    document.execCommand = exec as unknown as typeof document.execCommand;
    await expect(copyText('C:/x/inventory.json')).resolves.toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
  });

  it('扫描失败显示错误与 DevTools 提示', async () => {
    sendMessage.mockResolvedValueOnce({ ok: false, error: 'CDP attach 失败' });
    render(<App />);
    fireEvent.click(screen.getByText('扫描此页'));
    expect(await screen.findByText(/CDP attach 失败/)).toBeInTheDocument();
    expect(screen.getByText(/DevTools 开着会占用调试通道/)).toBeInTheDocument();
  });
});
```

需要在 `extension/tests/setup.ts` 加 `import '@testing-library/jest-dom/vitest';` 并在 `vitest.config.ts`（新建，或并入 wxt.config 的 `vite.test` 字段）配置：

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/popup-app.test.tsx'],
  },
});

// popup-app.test.tsx 需要 jsdom —— 用单独配置文件 vitest.popup.config.ts：
// environment: 'jsdom', include: ['tests/popup-app.test.tsx'], setupFiles: ['tests/setup.ts']
```

（两份 vitest 配置文件：`vitest.config.ts` 跑纯逻辑、`vitest.popup.config.ts` 跑组件；`npm test` 脚本改为 `vitest run && vitest run -c vitest.popup.config.ts`。）

同时实现 Task 7 注意事项里提到的 `lib/clipboard.ts`：

```ts
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.hidden = true;
    document.body.appendChild(ta);
    ta.select();
    try { return document.execCommand('copy'); } catch { return false; }
    finally { ta.remove(); }
  }
}
```

- [ ] **Step 4: 全量测试 + 构建**

Run: `cd extension && npm test && npm run build`
Expected: 全部 PASS；产物含 popup 与 background

- [ ] **Step 5: 手动冒烟（HMR 开发体验验证）**

```bash
cd extension && npm run dev
```

Chrome 加载 `.output/chrome-mv3`，点 popup 确认两视图可切换、无 console 报错（扫描行为在 Task 8 回归）。

- [ ] **Step 6: Commit**

```bash
git add extension && git commit -m "feat(extension): popup 重写为 React+Tailwind（组件化 + RTL 测试）"
```

---

### Task 8: 切换清理 + 回归 + 发布

**Files:**
- Delete: `extension/src/`（旧实现 9 文件）、`extension/manifest.json`（旧手写）、`extension/tests/` 下旧 `.js` 测试（classifier.test.js 等已被 `.ts` 取代者）
- Modify: `extension/tests/fixtures/axtree-register.json`（若 reducer 测试引用路径变化则同步）、根 `README.md`、`extension/package.json`（如 Task 1 已定稿则不动）

**Interfaces:**
- Consumes: 前 7 个任务的全部产物
- Produces: `wxt zip` 产出的 `casefront-extension-0.3.0.zip`；全绿测试；真实页面回归通过

- [ ] **Step 1: 删除旧实现**

```bash
git rm -r extension/src extension/manifest.json
git ls-files extension/tests | grep "\.js$"
# 上列出的旧 .js 测试逐个 git rm（.ts 版已存在且断言相同才允许删；先 diff 确认）
```

- [ ] **Step 2: 全量测试 + 构建 + 类型检查**

Run: `cd extension && npm test && npm run compile && npm run build`
Expected: 全部 PASS；`.output/chrome-mv3/manifest.json` 版本 0.3.0、权限三项齐全

- [ ] **Step 3: 真实页面全链路回归（手动，逐项记录）**

加载 `.output/chrome-mv3`，执行并对照旧版行为：
1. 打开含表单页面 → 「扫描此页」精简模式：状态区显示"已采集 N 个交互元素"，进入勾选视图
2. 完整模式扫描：不折叠、条目数 ≥ 精简模式
3. DevTools 开着时扫描：错误文案 + "关闭后重试"提示
4. 勾选：全选/全不选/单项；重扫同名会话继承上次勾选
5. 「保存并导出」：下载目录出现 `casefront/<会话>/inventory.json`，popup 显示绝对路径，「复制路径」粘贴一致
6. `selected` 写回：导出的 JSON 中取消勾选的元素 `"selected": false`
7. 新旧 `inventory.json` 结构 diff：仅时间戳字段不同

- [ ] **Step 4: README 更新（开发侧）**

根 `README.md` 方式 B 段落加：

```markdown
开发模式（插件侧已迁移至 WXT 构建）：
  cd extension && npm install && npm run dev   # HMR 开发
  npm test                                     # Vitest 全量测试
  npm run zip                                  # 产出分发包
用户安装方式不变（加载 .output/chrome-mv3 或 Release zip）。
```

- [ ] **Step 5: 发布包验证**

```bash
cd extension && npm run zip
```

Expected: 生成 `casefront-extension-0.3.0-chrome.zip`；解压确认为纯产物（无源码映射依赖）。

- [ ] **Step 6: Commit + 版本 tag**

```bash
git add -A && git commit -m "chore(extension): 移除旧 vanilla 实现，切换 WXT 0.3.0"
git tag v0.3.0
```

---

## 自查（计划级）

- **Spec 覆盖**：§2 目录/entrypoints（T1/T6）、契约类型（T2）、strict TS（T1/T2）、storage 缝（T5）、cdp-types（T6）、messages（T6/T7）；§3 组件与状态机（T7）、Tailwind token（T7）、无状态库（T7）；§5 测试迁移 + RTL 三主干（T3-T5、T7）+ 行为回归（T8）；§6 wxt zip/0.3.0/README（T8）；§7 风险对策体现在各任务约束与 T8 回归清单
- **占位符**：App.tsx 头部区块以「…」+ 迁移指令标注——该区块是纯样式搬运，指令已给出逐项对照来源（popup.html:213-225），不属于设计空缺
- **类型一致性**：`ScanResponse`/`DownloadExportResponse`/`Inventory`/`FoldGroup`/`ScanStorage` 各任务间签名已交叉核对
