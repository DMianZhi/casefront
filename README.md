# casefront — Web 测试用例 AI 前置助手

浏览器插件（采集页面交互）+ Comate Skill（规则匹配 + 用例生成）。

- 浏览器插件负责"看清"页面：**CDP 直读 a11y tree**，产出结构化交互清单 `inventory.json`
- Skill 负责"想好"：依据**规则卡**与测试者 demo 生成测试用例 `cases.md` / `cases.json`
- 插件与 Skill 之间只靠一份数据契约（JSON Schema）解耦

## 仓库结构（monorepo）

```
casefront/
  extension/               # 浏览器插件（CDP 采集、popup 勾选、下载导出）
  skill/                   # Comate Skill（规则匹配、用例生成）+ 内置规则卡
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
# chrome://extensions → 加载已解压的扩展程序 → 选 casefront/extension/
```

要求：Chromium 内核浏览器（Chrome / Edge）；扫描使用 `chrome.debugger` 权限，首次加载确认即可。

## 使用流程

1. 打开目标页面 → 点插件「扫描此页」（此时只采集＋存快照，**不写文件**；精简模式默认折叠同类元素；完整模式出全量清单）
2. 在勾选视图勾选要纳入用例生成的元素（新会话默认全选；同名会话重扫自动继承上次勾选）
3. 点「保存并导出」→ 清单自动下载到
   `下载/casefront/<会话>/inventory.json`（popup 显示落盘绝对路径，「复制路径」一键复制）
4. 在 Comate 中 `@` 该文件，运行 casefront Skill 生成用例

> DevTools 冲突提示：Chrome 同一标签页只允许一个 debugger。开着 DevTools 时扫描会被占用，
> 插件会提示先关闭 DevTools 再扫。

## 文档

- [设计文档](docs/superpowers/specs/2026-09-14-web-test-case-assistant-design.md)
- [M0 实现计划](docs/superpowers/plans/2026-09-14-casefront-m0-vertical-slice.md)

## 状态

- [x] 头脑风暴 → 设计文档（已评审通过）
- [x] M0 竖切：真实页面全链路（扫描 → 清单 → 用例）：829 元素采集 → 对话收敛 61 核心 → 18 条可追溯用例
- [x] M1 可用性：同类折叠（去噪阈值可配）、popup 勾选直写 selected、下载导出 + 一键复制绝对路径
- [ ] M2 学习闭环：临时业务规则 → 规则卡草稿、规则缺口报告
- [ ] M3 团队化：导出适配器、多页串联、规则卡托管
