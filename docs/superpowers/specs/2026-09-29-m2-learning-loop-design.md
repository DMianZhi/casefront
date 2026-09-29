# M2 学习闭环设计 — 临时规则沉淀、规则缺口台账、rules/ 完善流程

**日期**:2026-09-29
**状态**:已评审通过
**前置**:M0 竖切、M1 可用性、M1.5 插件重构均已完成(见 2026-09-14-web-test-case-assistant-design.md §8)

## 1. 一句话与验收标准

**一句话**:让规则卡体系"自我生长"机制化——对话中的临时业务规则沉淀为项目卡草稿、经确认入库;规则缺口从一次性字符串升级为跨会话台账;下次同页生成,质量因卡增厚可感知提升。

**验收标准**(对照总设计 §8 M2 行):

- 同页二次生成:第一轮沉淀的新卡规则在第二轮产出**字段级新用例**(可追溯 rule_refs),对应缺口从台账移除
- 草稿、正式卡、缺口台账三类产物落盘且通过校验脚本
- 无 Node 环境时闭环仍可纯对话走完(AI 自查兜底)

## 2. 决策记录

| # | 决策 | 结论 |
|---|------|------|
| D1 | 范围 | 三项全做:临时规则→草稿、缺口报告、rules/ 完善流程 |
| D2 | 草稿存放 | `workspace/rules/drafts/` 子目录;Skill 生成时只匹配正式卡,不自动消费草稿 |
| D3 | 缺口报告形态 | cases.json 内结构化 + `workspace/rules/gaps.json` 跨会话聚合,补齐即移除 |
| D4 | 入库与校验机制 | AI 对话执行文件操作 + 可选校验脚本 `validate-rules.mjs` 兜底格式 |
| D5 | 字段级规则作用域 | 规则卡 schema 新增可选 `scope` 字段(match_label / match_selector) |
| D6 | 脚本 YAML 解析 | 内置最小 YAML 解析器(受控格式),零第三方依赖 |
| D7 | 总体形态 | 方案 A:skill 内建第六步「沉淀」,插件零改动(否决独立管家 skill / 全脚本化) |

## 3. 目录契约(在总设计 §7 基础上扩展)

```
workspace/
  inventory/<session>/          # 不变:inventory.json + cases.json + cases.md
  rules/                        # 新增:项目级规则卡(正式区)
    *.yaml                      # 正式卡,文件名 = 卡 id
    drafts/                     # 草稿区,等确认入库
      *.yaml
    gaps.json                   # 跨会话缺口台账
  demo/examples.md              # 不变
```

**闭环数据流**:

```
第 2 步「匹配」产出结构化 rule_gaps(写入本次 cases.json)
        │
        ├─→ 第 6 步统一合并进 workspace/rules/gaps.json(补齐即清除)
        │
第 6 步「沉淀」:对话临时规则 → 草稿卡 YAML → rules/drafts/
        │      用户确认(收敛点③) → 写入 rules/ 正式区 → 删除已入库草稿
        │      → 可选 validate-rules.mjs 兜底
        ▼
下次同页生成:规则卡变厚 → 字段级新用例 → gaps.json 对应缺口清除
```

**职责边界**:

| 单元 | 职责 | 不负责 |
|------|------|--------|
| SKILL.md 第 6 步 | 归纳临时规则为卡、与用户确认、写文件 | 格式兜底(脚本) |
| validate-rules.mjs | YAML schema 校验、id 唯一性、gaps.json 自动清理 | 判断规则内容好坏 |
| rules/drafts/ | 存放待确认草稿 | 被生成流程自动消费 |
| gaps.json | 跨会话缺口台账 | 单次用例的 rule_gaps(cases.json 内) |

## 4. 契约设计

### 4.1 规则卡 schema v0.2 — 新增 `scope`(可选,向后兼容)

```yaml
id: text-input-project          # 项目卡 id:kebab-case,禁止与内置卡 id 冲突
applies_to: text_input
rules:
  - id: phone-11-digits
    title: 手机号 11 位
    detail: 手机号字段必须为 11 位数字,超出/不足均拦截
    priority: P1
    scope:                      # 可省略;省略 = 对该 applies_to 全部元素生效(现状语义)
      match_label: ["手机号", "电话", "mobile"]   # 对元素 label 子串包含匹配,数组内 OR
      # match_selector: ["input[type=tel]"]       # 可选,CSS 选择器命中即生效
```

- 匹配语义:`match_label` 与 `match_selector` 同时给 → AND;数组内部 → OR
- **匹配执行者是 AI**(第 2 步挂卡时读 inventory 元素 label/selector 判断);scope 只是把判断依据结构化,保证可追溯
- 12 张内置标准卡不加 scope,保持全类型语义
- 生成格式约定(供最小解析器,写入 SKILL.md):字符串可省引号、数组一律 flow 格式、禁用多行块 `|` / `>`

### 4.2 cases.json schema_version 0.1 → 0.2

唯一变更:`rule_gaps` 从字符串数组升级为对象数组(与 build-cases.mjs 既有实践对齐并正式定版):

```jsonc
"rule_gaps": [
  {
    "interaction_type": "date_picker",
    "gap_type": "thin",              // missing: 该类型无卡 | thin: 卡内规则 < 3 条
    "detail": "date_picker 项目卡仅 2 条规则,缺跨月与时间维度",
    "suggestion": "建议补 month-boundary、time-format 规则"
  }
]
```

- thin 阈值固定:**卡内规则数 < 3**;0 张卡 = missing
- 0.2 是 0.1 纯增量,其余字段不动

### 4.3 workspace/rules/gaps.json — 跨会话缺口台账

```jsonc
{
  "schema_version": "0.1",
  "gaps": [
    {
      "interaction_type": "date_picker",
      "gap_type": "thin",
      "detail": "…", "suggestion": "…",
      "first_seen": "2026-09-29_美术资产检索工作台",
      "sessions": ["2026-09-29_美术资产检索工作台"]   // 每次出现追加 session_id,去重
    }
  ]
}
```

- 合并键:`interaction_type + gap_type`;同键已有则追加 sessions、可更新 detail/suggestion
- **补齐即整条移除**,不保留历史(YAGNI);`first_seen` 供人回溯

### 4.4 草稿卡与入库合并语义

- 草稿 = 与正式卡完全同构的 YAML,文件名 = 卡 id,存 `rules/drafts/`
- 确认入库(收敛点③,AI 展示草稿全文 + 处置建议后等确认):
  - `rules/` 无同 applies_to 卡 → 草稿整体移入正式区(新建卡)
  - 已有同 applies_to 卡 → 规则**追加**进已有卡;同规则 id 已存在 → **更新覆写**该条(detail/priority)
  - 入库后删除对应草稿文件
- 纪律:带 scope 的规则必须能在 inventory 中指出命中元素,指不出不得入库(防"幽灵规则")

## 5. SKILL.md 管线变化(5 步 → 6 步)

### 5.1 第 2 步「匹配」增强

- 挂卡时处理 `scope`:带 scope 规则只挂命中元素,未命中元素跳过该规则;命中结果不单独落字段,自然体现在用例的 rule_refs + element_ids 上
- 产出结构化 `rule_gaps`(§4.2);gaps.json 合并延迟到第 6 步统一执行

### 5.2 新增第 6 步「沉淀」(收敛点③,交付用例之后执行)

```
⑥ 沉淀
   1. 汇总本次对话临时业务规则 + 本次 rule_gaps;两者皆空 → 跳过(空转保护)
   2. 临时规则 → 归纳草稿规则条目:推断 applies_to、拟 scope、判定新建/追加,
      生成草稿 YAML → 写 rules/drafts/
   3. 展示草稿全文 + 处置建议 → 等用户确认
   4. 确认后:写 rules/ 正式区(新建/追加/覆写),删除已入库草稿
   5. 合并 gaps.json:按 interaction_type+gap_type 合并、追加 sessions;
      比对当前规则卡,已补齐缺口整条移除
      (有 Node 时此步可整体交给脚本 gaps 子命令执行,AI 不重复手动操作)
   6. 校验:有 Node → 跑 scripts/validate-rules.mjs;无 Node → 按自查清单
      (applies_to ∈ 12 枚举、规则 id 卡内唯一、卡 id 不与内置冲突、scope 结构正确)
```

- 临时规则在对话任何时刻出现都先记录(本次生成即生效),第 6 步统一沉淀
- unclassified 元素建议的新类型卡(如时间选择器)同样走第 6 步落草稿

### 5.3 其他更新

- frontmatter `description` 追加触发语:"沉淀临时规则为规则卡、查看规则缺口"
- 「追溯与纪律」段补 scope 纪律条款
- 产出示例更新:0.2 结构化 rule_gaps + 草稿卡 YAML 示例

## 6. 校验脚本 skill/scripts/validate-rules.mjs

**零依赖**(Node 22+,`npx skills add` 分发后零安装可用)。无 js-yaml → 内置**最小 YAML 解析器**,只解析规则卡约定结构;解析失败报"格式超出约定"+ 文件名行号。

```bash
node <skill>/scripts/validate-rules.mjs validate [rulesDir]
# 校验 rules/ 与 rules/drafts/ 全部卡:必填字段(id/applies_to/rules 非空)、
# applies_to ∈ 12 枚举、规则 id 卡内唯一、卡 id kebab-case 且不与内置卡冲突
# (读 ../references/rules/*.yaml 取内置 id)、scope 结构正确(字符串数组)

node <skill>/scripts/validate-rules.mjs gaps [workspaceDir]
# 读 workspace/rules/gaps.json 按当前卡自动清理:
#   missing → 卡已存在则移除;thin → 卡内规则数 ≥3 则移除;
#   输出剩余缺口;文件不存在则新建
```

退出码:0 通过 / 1 有错;错误信息含文件与行号。

## 7. 错误处理决策表

| 场景 | 处理 |
|------|------|
| 同 id 草稿已存在 | 草稿区允许覆写,AI 先合并展示差异再写 |
| 入库时正式卡已有同规则 id | 更新覆写,确认展示中明说"将覆写 xx 卡的 yy 规则" |
| gaps.json 不存在 | 新建 |
| gaps.json 损坏 | 报错请用户决定,**不静默重建** |
| scope 规则匹配不到任何元素 | 指不出命中元素不得入库(§4.4 纪律) |
| 无 Node 环境 | AI 按自查清单兜底,闭环不依赖脚本 |
| 草稿确认被拒绝 | 保留草稿或按用户意见修改,不强行入库 |
| YAML 解析失败 | 报文件+行号,AI 修复重跑 |

## 8. 测试与验收

### 8.1 自动化测试(skill/scripts/validate-rules.test.mjs)

Node 内置 `node --test`,零依赖,`node --test skill/scripts/` 即跑;fixture 内联字符串:

- 最小 YAML 解析器:合法卡 / 缺字段 / flow 数组 / 引号变体 / 非法结构报错带行号
- validate:枚举校验、卡 id 与内置冲突、规则 id 卡内重复、scope 结构错误
- gaps:同键合并追加 sessions、补齐后移除、不存在新建、损坏报错不静默覆盖

### 8.2 既有资产回归

- 插件零改动,vitest 27+4 不受影响
- 顺势修正既有不一致:`extension/scripts/build-cases.mjs` 的 `schema_version: '0.1'` → `'0.2'`(其 rule_gaps 本已是对象数组)

### 8.3 手动验收(testpage 两轮)

| 轮次 | 动作 | 应看到 |
|------|------|--------|
| 第一轮 | 扫描 → 生成 cases → 对话给临时规则(如"资产编号必须大写字母开头")→ 沉淀 | drafts/ 出现草稿卡;cases.json 结构化 rule_gaps;gaps.json 台账建立;validate 通过 |
| 确认 | 展示草稿 + 处置建议 → 确认 | 草稿入正式区,drafts/ 清空 |
| 第二轮 | 同页重扫重生成 | 字段级新用例(带 rule_refs)、对应缺口移除、cases 可感知变厚 |

## 9. 范围外(本设计明确不做)

- 插件侧任何改动(缺口/草稿均为 skill 侧产物)
- 草稿历史版本、缺口解决历史(补齐即移除)
- 规则卡多文件聚合格式、多维表托管(M3 远景)
- 独立规则管家 skill(见 D7 否决理由)

## 10. 风险与对策

| 风险 | 对策 |
|------|------|
| SKILL.md 5→6 步变长 | 沉淀步骤措辞精炼;空转保护避免每次打扰 |
| scope 匹配靠 AI 判断可能不稳 | 双保险:入库纪律条款 + validate 结构校验 |
| 最小 YAML 解析器遇到约定外格式 | 解析失败报行号引导修复;格式约定写入 SKILL.md |
| gaps.json 跨会话被误删 | 损坏时报错请用户决定,不静默重建 |
