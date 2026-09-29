---
name: casefront
description: Web 测试用例 AI 前置助手。读取插件产出的 inventory.json（页面交互清单），结合内置规则卡与项目 rules/*.yaml 生成测试用例（cases.md + cases.json），并把对话中的临时业务规则沉淀为规则卡草稿、维护规则缺口台账。当用户需要"根据页面交互清单生成测试用例"、"扫描结果生成用例"、提供交互清单文件要求生成测试用例、说"跑 casefront 流水线"或 @ inventory.json，或要求"沉淀规则卡 / 查看规则缺口"时使用。
---

# casefront — Web 测试用例 AI 前置助手（Skill 侧）

> 输入：`inventory/＜session＞/inventory.json`（插件产出，schema_version 0.1，契约见 docs/superpowers/specs/2026-09-14-web-test-case-assistant-design.md §4.1）
> 输出：同目录 `cases.md` + `cases.json`（schema_version 0.2）；另沉淀 `rules/drafts/*.yaml` 草稿与 `rules/gaps.json` 缺口台账

## 输入清单

- `inventory.json`：插件产出（契约 §4.1）；`confidence < 0.9` 与 `unclassified` 需走裁决
- `rules/*.yaml`：项目级规则卡（正式区），按 `applies_to` 覆写/追加内置标准卡（§4.5）；
  带 `scope` 的规则只对命中元素生效（见「规则卡格式约定」）
- `rules/drafts/*.yaml`：草稿区——**生成管线不消费草稿**，只消费正式区与内置卡
- `references/rules/*.yaml`：内置 12 张标准卡，覆盖全部 interaction_type（text_input / textarea / select / radio / checkbox / button / link / file_upload / date_picker / pagination / dialog / tabs）
- `rules/gaps.json`：跨会话缺口台账（第 6 步读写）
- `demo/examples.md`：测试者手写用例样例，用于风格对齐（可缺省）
- 对话中的临时业务规则：**对话任何时刻出现都先记录**（本次生成即生效），第 6 步统一沉淀

## 生成管线（六步，演示页走完才能交付）

1. **裁决**：列出全部 `confidence < 0.9` 的 elements 与 `unclassified`，逐条给出你判定的
   interaction_type 与理由；低信心项请用户确认（**收敛点①**）。unclassified 只建议、不自动纳入。
2. **匹配**：读内置卡与 `rules/` 项目卡，按 `applies_to` 挂卡；**带 `scope` 的规则只挂命中元素**
   （match_label 对元素 label 子串包含匹配、match_selector 按选择器匹配，两者同时给取 AND、
   数组内取 OR），未命中元素跳过该规则——命中结果不单独落字段，自然体现在用例的
   rule_refs + element_ids 上。`selected=false` 的元素跳过并记入 `coverage.skipped_reasons`；
   某类型（内置+项目合并视角）无卡 → 记 missing 缺口、卡内规则 < 3 条 → 记 thin 缺口，
   产出结构化 `rule_gaps`（见产出示例）。（1 元素 × N 规则 = N 个检查点，全部携带规则 id）
3. **收敛**：按「共性合并/个性独立」（见下）拟出检查点清单摘要 → 用户确认范围后继续
   （**收敛点②**）。宁少勿滥，范围外不自动加 case。
4. **组装**：检查点 → 用例。**共性规则**（empty-submit / xss 等全表单共性项）同区块合并成
   一条；**个性规则**（选项往返、防重复提交等）一元素一条。priority 取规则卡默认值，
   可按页面上下文整体修正但需在对话中说明。
5. **对齐**：若 `demo/examples.md` 存在，先总结其结构/措辞/粒度习惯，再按其风格写 cases.md；
   cases.json 每条带 `style_source`。
6. **沉淀**（**收敛点③**，交付用例后执行；无临时规则且 rule_gaps 为空 → 跳过）：
   1. 汇总本次对话临时业务规则 + 本次 `rule_gaps`
   2. 临时规则 → 归纳为草稿卡规则条目：推断 applies_to、拟 `scope`（字段级规则必须拟 scope）、
      判定「新建卡 or 追加进已有卡」，生成草稿 YAML → 写 `rules/drafts/`；
      同 id 草稿已存在 → 先合并展示差异再覆写
   3. 展示草稿全文 + 处置建议（新建 / 追加 / 更新覆写 xx 卡的 yy 规则）→ 等用户确认；
      被拒绝 → 保留草稿或按用户意见修改，不强行入库
   4. 确认后：写 `rules/` 正式区（新建卡 / 追加规则 / 同规则 id 覆写），删除已入库草稿文件
   5. 合并台账：本次缺口按 `interaction_type + gap_type` 合并进 `rules/gaps.json`
      （同键追加 sessions、更新 detail/suggestion；同会话不重复），并按当前卡况清理已补齐缺口
   6. 校验：环境有 Node → 依次运行
      `node <skill>/scripts/validate-rules.mjs validate <workspace>/rules` 与
      `node <skill>/scripts/validate-rules.mjs gaps <workspace> --from <session>/cases.json`
      （后者完成第 5 小步的台账合并+清理，AI 不重复手动操作）；无 Node → 按下方自查清单自查

## 追溯与纪律

- 每条用例必须携带 `rule_refs`（`卡id:规则id`）与 `element_ids`；缺任何一项不得输出。
- **scope 纪律**：带 scope 的规则必须能在 inventory 中指出命中的元素，指不出不得入库
  （防"幽灵规则"污染后续生成）。
- cases.json 结构（契约 §4.4，schema_version 0.2）：schema_version / meta / cases[] / coverage /
  rule_gaps（结构化对象数组，无缺口时为 []，见产出示例）。
- **规则缺口清单**：结构化 rule_gaps 附在报告末尾成表，并经第 6 步进台账——规则卡体系
  自我生长的入口，测得越多卡越厚。
- **临时规则沉淀**：对话中的特殊业务规则（如"手机号必须11位"）除本次生效外，第 6 步归纳为
  草稿卡，经用户确认后入 `rules/`——对话知识沉淀为团队资产。

## 规则卡 YAML 格式约定（供脚本解析器，必须遵守）

- 缩进：顶层 0 空格、列表项 2 空格（`- id: …`）、规则字段 4 空格、scope 字段 6 空格
- 字符串可省引号；**值中含 `: `（冒号+空格）必须整体加引号**
- 数组一律 flow 格式 `["a", "b"]`；数组元素不得含逗号
- 禁用多行块（`|`、`>`）与锚点/引用
- 无 Node 环境时的自查清单：applies_to ∈ 12 枚举、规则 id 卡内唯一、卡 id kebab-case 且
  不与内置卡 id 冲突、scope 只含 match_label / match_selector 且均为字符串数组

### 项目卡示例

```yaml
id: text-input-project
applies_to: text_input
rules:
  - id: asset-code-uppercase
    title: 资产编号大写开头
    detail: 资产编号字段输入小写开头的编号，提交应被拦截
    priority: P1
    scope:
      match_label: ["资产编号", "编号"]
```

## 产出示例（字段级样例，禁止原样拷贝进产物）

```json
{
  "schema_version": "0.2",
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
  "rule_gaps": [{
    "interaction_type": "date_picker",
    "gap_type": "thin",
    "detail": "date_picker 卡仅 2 条规则，缺跨月与时间维度",
    "suggestion": "建议补 month-boundary、time-format 规则"
  }]
}
```
