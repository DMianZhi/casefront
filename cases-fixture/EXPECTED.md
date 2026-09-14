# M0 验收核对单

- [ ] inventory.json：elements ≥ 6（手机号/密码/下拉/checkbox/注册按钮/链接）
- [ ] disabled 按钮（获取验证码）保留且 state.disabled=true；装饰 span（※仅仅装饰※）不出现
- [ ] unclassified 不为空时全部有 role/name 记录（不丢弃原则）
- [ ] Skill 对话出现「裁决」节（本 fixture 全部高信心，应说明"无需裁决"）
- [ ] cases 数量 10~30；空值/边界/XSS 检查点来自 text_input 卡；select/button 卡命中
- [ ] 每条 case 有 rule_refs + element_ids；coverage 与实际元素数一致
- [ ] cases.md 风格与 demo/examples.md 示例一致（标题/前置/步骤/预期/优先级五段）
