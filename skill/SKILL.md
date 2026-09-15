---
name: casefront
description: Web 测试用例 AI 前置助手。读取插件产出的 inventory.json（页面交互清单），结合内置规则卡与项目 rules/*.yaml 生成测试用例（cases.md + cases.json）。当用户需要"根据页面交互清单生成测试用例"、"扫描结果生成用例"、提供交互清单文件要求生成测试用例、说"跑 casefront 流水线"或 @ inventory.json 时使用。
---

# casefront — Web 测试用例 AI 前置助手（Skill 侧）

> 输入：`inventory/＜session＞/inventory.json`（插件产出，schema_version 0.1，契约见 docs/superpowers/specs/2026-09-14-web-test-case-assistant-design.md §4.1）
> 输出：同目录 `cases.md` + `cases.json`

## 输入清单

- `inventory.json`：插件产出（契约 §4.1）；`confidence < 0.9` 与 `unclassified` 需走裁决
- `rules/*.yaml`：项目级规则卡，按 `applies_to == interaction_type` 覆写/追加内置标准卡（§4.5）
- `references/rules/*.yaml`：内置 12 张标准卡，覆盖全部 interaction_type（text_input / textarea / select / radio / checkbox / button / link / file_upload / date_picker / pagination / dialog / tabs）
- `demo/examples.md`：测试者手写用例样例，用于风格对齐（可缺省）
- 对话中的临时业务规则

## 生成管线（五步，演示页走完才能交付）

1. **裁决**：列出全部 `confidence < 0.9` 的 elements 与 `unclassified`，逐条给出你判定的
   interaction_type 与理由；低信心项请用户确认（**收敛点①**）。unclassified 只建议、不自动纳入。
2. **匹配**：读内置卡与 `rules/` 项目卡，按 `applies_to` 挂卡；`selected=false` 的元素跳过并
   记入 `coverage.skipped_reasons`；某 interaction_type 无卡或卡过薄 → 记入 `rule_gaps`。
   （1 元素 × N 规则 = N 个检查点，全部携带规则 id）
3. **收敛**：按「共性合并/个性独立」（见下）拟出检查点清单摘要 → 用户确认范围后继续
   （**收敛点②**）。宁少勿滥，范围外不自动加 case。
4. **组装**：检查点 → 用例。**共性规则**（empty-submit / xss 等全表单共性项）同区块合并成
   一条；**个性规则**（选项往返、防重复提交等）一元素一条。priority 取规则卡默认值，
   可按页面上下文整体修正但需在对话中说明。
5. **对齐**：若 `demo/examples.md` 存在，先总结其结构/措辞/粒度习惯，再按其风格写 cases.md；
   cases.json 每条带 `style_source`。

## 追溯与纪律

- 每条用例必须携带 `rule_refs`（`卡id:规则id`）与 `element_ids`；缺任何一项不得输出。
- cases.json 结构（契约 §4.4）：schema_version / meta / cases[] / coverage / rule_gaps。
- **规则缺口清单**：缺失或过薄的 interaction_type 卡整理成表，附在报告末尾——规则卡体系
  自我生长的入口，测得越多卡越厚。
- **临时规则沉淀**：对话中的特殊业务规则（如"手机号必须11位"）除本次生效外，生成对应
  YAML 卡草稿建议（applies_to + rule 条目），经用户确认后存入 `rules/`。

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
