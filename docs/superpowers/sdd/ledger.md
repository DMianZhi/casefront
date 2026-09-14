# SDD Ledger — casefront M0 竖切

- Base: de8dd23, Branch: m0-vertical-slice
- 模式: 行内执行+闸门保留（环境无子代理派发，Ruling 已记录）
- Ruling: Windows/Node22 下统一使用无参 `node --test`（目录参数形式退化 CJS 加载）— 影响计划中所有 Run 命令的执行方式，不改断言 — 若错：仅是命令行用法，测试发现机制仍等价
- Ruling: 本环境偶发文件工具写入截断/损坏（Task 2 的 66 字节 reducer、Task 4 的 4 处坏点 classifier）——对策：重要文件写入后必须读回验证，异常立即修复 — 若错：损坏文件会导致语法错误，测试红灯会暴露
- Task 1: complete (commit ac02797; 2/2 pass; 统一 `node --test` 无参运行)
- Task 2: complete (commit 6386fc7; 4/4 pass; fixture 6 候选与 spec §5.4 一致)
- Task 3: complete (commit fa16e2c; 6/6 pass 含回归)
- Task 4: complete (commit 0b4e57c; 8/8 pass 含回归; 分类映射表与 spec §5.4 一致, pagination 0.6→unclassified 路径由 splitByConfidence 兜底)
- Next: Task 5 buildInventory
| Task 6 | 插件壳/胶水 | R: 计划代码 sendCommand 签名笔误（`{method,params}`应为`, params`），已修正新增 `send` 闭包绑定 target（计划自身提交前说明已预告）→ 零成本 | 静态自查语法 OK + 9 回归绿；单测不适用 | 75d59cd |
| Task 6 | 78% | 落实计划修正说明：send 闭包绑 target；sendCommand 签名 (target, method, params)；splitByConfidence 三桶直接用 | node --check OK；9 tests PASS | 75d59cd |

## Task 6 插件壳 background（commit 75d59cd）
- Status: 完成（静态自查通过；真实浏览器手测归 Task 9 E2E）
- Ruling: 计划笔误修正——`chrome.debugger.sendCommand(target, method, params)` 三参签名（计划中 `(target, {method, params})` 不能用）
- Ruling: unclassified 不需要二次 classify——`splitByConfidence` 本身返回第三桶
- Files: extension/src/background.js（107 行，send 闭包绑定 target、try/finally detach 已落实）
