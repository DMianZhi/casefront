# casefront 插件重构设计：WXT + React + TypeScript

- **日期**：2026-09-19
- **状态**：已评审（对话中分节确认）
- **范围**：仅 `extension/`；`skill/`、数据契约（schema_version 0.1）、用户可见行为均不变
- **前置阅读**：`docs/superpowers/specs/2026-09-14-web-test-case-assistant-design.md`（§4.1 契约）

## 1. 背景与目标

现插件为 MV3 vanilla JS + ESM、**零构建零依赖**（`node --test` 测试）。M0/M1 功能已验证，但：
- popup 202 行命令式 DOM 操作 + 294 行内联 HTML/CSS，无组件测试
- 契约类型只靠设计文档约束，无编译期保障
- 无框架工具链（无 HMR、手写 manifest），M2/M3 的 UI 与逻辑增长会放大这些成本

**目标**：引入 WXT 框架 + React + TypeScript 重构插件骨架，逻辑模块一并 TS 化、边界收紧，为 M2/M3 打基础。
**非目标**：不改算法行为（去噪阈值、折叠签名、置信度分流、session_id 生成等逐行等价迁移）；不改 inventory.json 契约；不做 M2/M3 新功能。

决策记录（对话确认）：范围=重构+内部升级（非纯等价迁移）；测试=Vitest；包结构=extension/ 独立 WXT 项目（仓库根不加 workspace）；UI=React + Tailwind（重写样式）。

## 2. 架构与目录

```
extension/
  wxt.config.ts          # WXT 配置：manifest 字段声明 name/description/permissions；版本号与 package.json 同源
  package.json           # wxt, react, react-dom, tailwindcss, vitest, @testing-library/react, jsdom, typescript
  tsconfig.json          # strict: true，noUncheckedIndexedAccess: true
  entrypoints/
    background.ts        # CDP 编排（现 src/background.js 迁移，行为不变）
    popup/
      index.html
      main.tsx
      App.tsx            # 视图切换（scan/review）
      components/        # StatusPanel / Icon / ElementList / ElementItem / ExportBar
  lib/                   # 纯逻辑，全部 TS，与 UI/运行时解耦，可被 Vitest 无环境依赖地测
    inventory.ts         # ★ 契约类型单一事实源（Inventory/Element/InteractionType 12 值 union）
    classifier.ts  denoiser.ts  fold-groups.ts  reducer.ts  exporter.ts  selection.ts
    storage.ts           # IndexedDB 最小封装（接口抽象，为 M2 换存储留缝）
    cdp-types.ts         # 实际用到的 CDP 方法最小类型（不引第三方 CDP 类型包）
    messages.ts          # popup ↔ background 消息 discriminated union
  tests/                 # Vitest：现有 8 个测试迁移 + 新增组件测试
```

- 手写 `manifest.json` 删除，由 WXT 生成（permissions 不变：`debugger`/`downloads`/`tabs`）。
- `lib/inventory.ts` 把"靠文档约束"的契约变成编译期类型，是本次核心新增资产。

## 3. TypeScript 化与逻辑模块升级

- `tsconfig` 严格模式 + `noUncheckedIndexedAccess`（遍历 a11y 树节点的代码最易踩 undefined）。
- 迁移策略：**算法不变，只做类型化与边界收紧**：
  - `classifier.ts`：`interaction_type` 收紧为 12 值 union（与 skill 规则卡一一对应）；`Classified` 类型显式化
  - `reducer.ts` / `fold-groups.ts`：输入输出类型来自 `inventory.ts`，内部逻辑不动
  - `exporter.ts`：`buildInventory` 入参类型化；`schema_version: '0.1'` 字面量类型锁定
  - `selection.ts`：`reconcileElements` / `applySelections` 类型化；IndexedDB 存取抽到 `storage.ts`
  - `cdp-types.ts`：手写 `AXNode`、`DOM.resolveNode`、`Runtime.callFunctionOn` 等实际用到的方法响应类型
- 错误处理保持现有"诚实降级"风格：enrich 单元素失败不阻塞、IDB 失败不阻塞导出、debugger 任何路径必须 detach。不为了类型把降级路径改成抛异常（避免行为漂移）。

## 4. UI 层（React + Tailwind）

- 组件与状态：
  - `App.tsx` 用 `useReducer` 管理扫描生命周期（idle/loading/ok/err/warn）+ `session`、`pending`（勾选 Map）、`exportPath`
  - `StatusPanel`：状态区（主/副文案）；`Icon`：现 5 枚内联 SVG（idle/load/ok/err/warn）组件化
  - `ElementList` / `ElementItem`：清单勾选（复选框 + 名称/占位符 + 类型徽章 + 折叠组徽章）
  - `ExportBar`：保存导出 + 路径行 + 复制路径（含 `execCommand` 回落）
- Tailwind：现有深色主题色板变量（`--text-3`/`--blue`/`--green`/`--red`/`--orange`）收进 Tailwind 主题 token；popup 固定宽度等布局参数保持
- 消息协议：`SCAN` / `GET_LAST_SCAN` / `DOWNLOAD_EXPORT` 及响应在 `lib/messages.ts` 定义 discriminated union，两侧共用
- 不引入状态库（popup 体量用不上；M2 UI 膨胀时再评估）

## 5. 测试与回归

- 现有 8 个测试文件（classifier/denoiser/fold-groups/reducer/exporter/exporter-groups/selection/constants）逐一迁移为 Vitest，**断言内容不变**，仅改 import 与运行方式
- 新增 React Testing Library 组件测试，覆盖三条主干：视图切换（scan→review→back）、勾选计数（全选/全不选/单项）、复制路径回退（clipboard API 失败 → execCommand）
- `npm test` 一键全量；CI 可后续接入（非本次范围）
- **行为回归**：真实页面手动全链路（扫描 → 精简/完整模式 → 勾选 → 导出 → 复制路径），对比新旧 `inventory.json` 结构一致（时间戳类字段除外）

## 6. 发布与文档

- `wxt zip` 产出分发包，替代手工 zip；版本 bump 至 **0.3.0**（结构性重构）
- README 更新：开发方式（`npm install` / `npm run dev` HMR）、测试命令；用户侧安装方式不变（加载已解压 `extension/` 或 Release zip）
- 仓库根 `KSCC.md`（7 维自查协议）在实现阶段强制执行

## 7. 风险与对策

| 风险 | 对策 |
| --- | --- |
| MV3 service worker 构建产物行为差异（如 chunk 拆分导致消息监听丢失） | WXT 对 background 有专门处理；回归测试覆盖 popup↔background 三条消息 |
| Chrome 同标签页 debugger 独占问题在 dev 模式下更频繁 | 保持扫描前后的 attach/detach 语义不变；DevTools 冲突文案不变 |
| Tailwind 重写样式引入视觉回归 | 以现有 CSS 变量为 token 基准，逐区块对照迁移；固定 popup 宽度不变 |
| TS 严格化暴露潜在 null 缺陷导致行为改变 | 迁移时发现的行为差异必须单独记录并向用户确认，不静默"顺手修" |
