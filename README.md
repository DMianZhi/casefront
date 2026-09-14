# casefront — Web 测试用例 AI 前置助手

浏览器插件（采集页面交互）+ Comate Skill（规则匹配 + 用例生成）。

- 浏览器插件负责"看清"页面：CDP 直读 a11y tree，产出结构化交互清单 `inventory.json`
- Skill 负责"想好"：依据规则卡与测试者 demo 生成测试用例 `cases.md` / `cases.json`
- 插件与 Skill 之间只靠一份数据契约（JSON Schema）解耦

## 仓库结构（monorepo）

```
casefront/
  extension/               # 浏览器插件（CDP 采集、popup）
  skill/                   # Comate Skill（规则匹配、用例生成）
  demo/examples.md         # 测试者手写的风格样例（few-shot）
  docs/superpowers/specs/  # 设计文档
```

## 文档

- [设计文档](docs/superpowers/specs/2026-09-14-web-test-case-assistant-design.md)

## 状态

- [x] 头脑风暴 → 设计文档（已评审通过）
- [ ] M0 竖切：真实页面全链路（扫描 → 清单 → 用例）
