# casefront — Web 测试用例 AI 前置助手

浏览器插件（采集页面交互）+ AI agent Skill（规则匹配 + 用例生成），两者只靠数据契约解耦，可搭配任意 AI 编码助手使用。

- 浏览器插件负责"看清"页面：**CDP 直读 a11y tree**，产出结构化交互清单 `inventory.json`
- Skill 负责"想好"：依据**规则卡**与测试者 demo 生成测试用例 `cases.md` / `cases.json`
- 插件与 Skill 之间只靠一份数据契约（JSON Schema）解耦

## 仓库结构（monorepo）

```
casefront/
  extension/               # 浏览器插件（WXT + React + TypeScript；CDP 采集、popup 勾选、下载导出）
  skill/                   # 用例生成 Skill（SKILL.md + 内置规则卡），遵循 agentskills 规范
  demo/examples.md         # 测试者手写的风格样例（few-shot，可留空）
  docs/superpowers/specs/  # 设计文档
  docs/superpowers/plans/  # 实现计划
```

## 下载安装

**方式 A：下载 Release 包（推荐同事使用）**

1. 到 [Releases](https://github.com/DMianZhi/casefront/releases) 下载最新 `casefront-extension-vX.Y.Z.zip` 并解压
2. Chrome 打开 `chrome://extensions` → 右上角开启「开发者模式」
3. 「加载已解压的扩展程序」→ 选中解压出的 `extension/` 目录
4. 工具栏钉住 CaseFront 图标即可使用

**方式 B：克隆仓库（开发/最新代码）**

```bash
git clone https://github.com/DMianZhi/casefront.git
cd casefront
# chrome://extensions → 加载已解压的扩展程序 → 选 casefront/extension/.output/chrome-mv3/
```

插件侧已迁移至 **WXT + React + TypeScript**（v0.3.0），构建与开发：

```bash
cd extension
npm install        # 含 postinstall 自动 wxt prepare
npm run dev        # HMR 开发（加载 .output/chrome-mv3）
npm test           # Vitest 全量测试（纯逻辑 27 + 组件 4）
npm run compile    # tsc --noEmit 类型检查
npm run build      # 产物输出 .output/chrome-mv3
npm run zip        # 产出分发包 casefront-extension-vX.Y.Z-chrome.zip
```

代码结构：`entrypoints/`（popup React 组件 + background CDP 编排）、`lib/`（纯逻辑 TS 模块，
含契约类型单一事实源 `lib/inventory.ts`）、`tests/`（Vitest）。
用户安装方式不变（加载 `.output/chrome-mv3` 或 Release zip）。

要求：Chromium 内核浏览器（Chrome / Edge）；扫描使用 `chrome.debugger` 权限，首次加载确认即可。

**Skill 安装（用例生成侧）**

首选：一行命令（需 Node.js 22.20+，支持 Claude Code、Cursor、Codex、Windsurf、opencode 等 79 个 agent）：

```bash
npx skills add DMianZhi/casefront
```

交互式选择目标 agent；非交互可指定：`npx skills add DMianZhi/casefront --agent claude-code -y`。

兜底：手动安装（无 Node 环境时）：

1. 到 [Releases](https://github.com/DMianZhi/casefront/releases) 下载 `casefront-skill-vX.Y.Z.zip`
   并解压，得到 `casefront/` 目录（含 `SKILL.md` 与 `references/rules/` 内置规则卡）
2. 放入你所用 AI 助手的技能目录：
   - Claude Code：`~/.claude/skills/casefront`
   - 其他 agent：按其 skill 安装约定放置（SKILL.md 遵循 agentskills.io 规范，纯 Markdown + YAML，无平台绑定）

新会话中说「用 casefront 生成测试用例」或直接 `@ inventory.json` 触发。

## 使用流程

1. 打开目标页面 → 点插件「扫描此页」（此时只采集＋存快照，**不写文件**；精简模式默认折叠同类元素；完整模式出全量清单）
2. 在勾选视图勾选要纳入用例生成的元素（新会话默认全选；同名会话重扫自动继承上次勾选）
3. 点「保存并导出」→ 清单自动下载到
   `下载/casefront/<会话>/inventory.json`（popup 显示落盘绝对路径，「复制路径」一键复制）
4. 把 inventory.json 交给你的 AI 编码助手（Claude Code、Codex、Cursor 等均可），
   运行 casefront Skill 生成用例

> DevTools 冲突提示：Chrome 同一标签页只允许一个 debugger。开着 DevTools 时扫描会被占用，
> 插件会提示先关闭 DevTools 再扫。

## 文档

- [设计文档](docs/superpowers/specs/2026-09-14-web-test-case-assistant-design.md)
- [M0 实现计划](docs/superpowers/plans/2026-09-14-casefront-m0-vertical-slice.md)
- [插件重构设计（WXT + React + TS）](docs/superpowers/specs/2026-09-19-wxt-react-refactor-design.md)
- [插件重构实现计划](docs/superpowers/plans/2026-09-19-wxt-react-refactor.md)

## 状态

- [x] 头脑风暴 → 设计文档（已评审通过）
- [x] M0 竖切：真实页面全链路（扫描 → 清单 → 用例）：829 元素采集 → 对话收敛 61 核心 → 18 条可追溯用例
- [x] M1 可用性：同类折叠（去噪阈值可配）、popup 勾选直写 selected、下载导出 + 一键复制绝对路径
- [x] M1.5 插件重构（v0.3.0）：WXT + React + TypeScript，契约类型单一事实源（`lib/inventory.ts`），
      消息协议类型化，IndexedDB 存储抽接口，测试迁移 Vitest 并新增组件测试——行为与契约不变，为 M2/M3 打底
- [ ] M2 学习闭环：临时业务规则 → 规则卡草稿、规则缺口报告
- [ ] M3 团队化：导出适配器、多页串联、规则卡托管
