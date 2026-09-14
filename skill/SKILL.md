---
name: casefront
description: Web 测试用例 AI 前置助手。读取插件产出的 inventory.json（页面交互清单）， 结合内置规则卡与项目 rules/*.yaml 生成测试用例（cases.md + cases.json）。 当用户需要"根据页面交互清单生成测试用例"、"扫描结果生成用例"、 提供交互清单文件要求生成测试用例时使用。
---

# casefront — Web 测试用例 AI 前置助手（Skill 侧）

> 状态：M0 待实现。本文件为契约占位，实现计划见 docs/ 下 writing-plans 产出。

## 输入

- `inventory.json`：插件产出（schema 见 docs/superpowers/specs/2026-09-14-web-test-case-assistant-design.md §4.1）
- `rules/*.yaml`：项目级规则卡，覆盖/追加内置标准卡（§4.5）
- `demo/examples.md`：测试者手写用例样例，用于风格对齐
- 对话中的临时业务规则

## 生成管线（五步）

1. **裁决**：低 confidence 元素 AI 终审说明理由；unclassified 猜测+建议卡，不自动纳入 —— **收敛点①**
2. **匹配**：内置标准卡 ← 项目卡覆写/追加 → 每个 selected 元素挂规则卡 → 检查点清单
3. **收敛**：用户确认检查点范围（对话勾选）—— **收敛点②**
4. **组装**：检查点 → 用例（共性规则合并成一条，个性规则独立成案），分配优先级
5. **对齐**：demo few-shot 校正结构/措辞/粒度

## 输出

- `cases.md`：人读（写入 session 目录）
- `cases.json`：机读中间资产，带 rule_refs + element_ids 完整追溯链、coverage、rule_gaps
- 规则缺口清单：缺失/过薄的 interaction_type 卡，附在报告末尾
- 临时业务规则 → YAML 卡草稿建议，供确认后存入 rules/
