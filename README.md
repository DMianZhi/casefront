# casefront — Web 测试用例 AI 前置助手

浏览器插件（采集页面交互）+ Comate Skill（规则匹配 + 用例生成）。

- 浏览器插件负责"看清"页面：**CDP 直读 a11y tree**，产出结构化交互清单 `inventory.json`
- Skill 负责"想好"：依据**规则卡**与测试者 demo 生成测试用例 `cases.md` / `cases.json`
- 插件与 Skill 之间只靠一份数据契约（JSON Schema）解耦

## 仓库结构（monorepo）

```
casefront/
  extension/               # 浏览器插件（CDP 采集、popup 勾选、目录直写）
  skill/                   # Comate Skill（规则匹配、用例生成）+ 内置规则卡
  demo/examples.md         # 测试者手写的风格样例（few-shot，可留空）
  docs/superpowers/specs/  # 设计文档
  docs/superpowers/plans/  # 实现计划
```

## 使用流程（M1）

1. `chrome://extensions` → 开发者模式 → 加载已解压的扩展程序 → 选 `extension/`
2. 打开目标页面 → 点插件「扫描此页」（此时只采集＋存快照，**不写文件**；精简模式默认折叠同类元素；完整模式出全量清单）
3. 在勾选视图勾选要纳入用例生成的元素（新会话默认全选；同名会话重扫自动继承上次勾选）
4. 首次导出前点「授权目录」选工作区根目录 → 之后导出直写
   `workspace/inventory/<会话>/inventory.json`（无授权时自动回退浏览器下载）
4. popup 勾选视图：勾掉本次不需要测的元素（重扫自动继承上次勾选）
5. 点「保存并导出」→ 勾选结果 `selected` 写回清单 → 在 Comate 中 `@` 该文件，运行 casefront Skill 生成用例

> DevTools 冲突提示：Chrome 同一标签页只允许一个 debugger。开着 DevTools 时扫描会被占用，
> 插件会提示先关闭 DevTools 再扫。

## 文档

- [设计文档](docs/superpowers/specs/2026-09-14-web-test-case-assistant-design.md)
- [M0 实现计划](docs/superpowers/plans/2026-09-14-casefront-m0-vertical-slice.md)

## 状态

- [x] 头脑风暴 → 设计文档（已评审通过）
- [x] M0 竖切：真实页面全链路（扫描 → 清单 → 用例）：829 元素采集 → 对话收敛 61 核心 → 18 条可追溯用例
- [x] M1 可用性：同类折叠（去噪阈值可配）、popup 勾选直写 selected、目录授权直写落盘
- [ ] M2 学习闭环：临时业务规则 → 规则卡草稿、规则缺口报告
- [ ] M3 团队化：导出适配器、多页串联、规则卡托管
