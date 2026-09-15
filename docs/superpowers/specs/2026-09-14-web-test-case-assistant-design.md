# Web 测试用例 AI 前置助手 — 设计文档

- 日期：2026-09-14
- 状态：待评审
- 流程：superpowers / brainstorming（architectural 路径），四段设计已逐段确认

## 1. 产品定位与核心理念

**一句话**：浏览器插件负责"看清"页面（采集所有可交互元素），Skill 负责"想好"（依据规则卡与测试者 demo 生成测试用例）。

**核心理念**：把"认知负担"从 AI 侧挪到确定性工具侧。AI 写不好 Web 用例的根因是"看不见"页面——插件解决感知问题，Skill 解决知识（规则卡）与风格（demo 对齐）问题。

**用户与场景**：软件测试者（Web 端），在开始测试某个页面前，用助手前置生成该页面的测试用例。

## 2. 关键决策记录（头脑风暴收敛结果）

| # | 决策点 | 结论 |
|---|--------|------|
| D1 | 测试对象范围 | **单页快照起步**，架构预留多页串联扩展空间 |
| D2 | 插件→Skill 数据流 | **文件契约**：插件与 Skill 之间只靠一份 JSON Schema（inventory.json）说话 |
| D3 | 用例产出形式 | **Markdown + JSON 起步**（人读 + 机读中间资产），出口格式做成可扩展适配器 |
| D4 | 规则卡来源与维护 | **内置标准卡保底 + 项目级 rules/ 目录（YAML）扩展**，按 interaction_type 覆写/追加；多维表托管为后续升级路径 |
| D5 | 使用场景（采集触发） | **测前扫描**：测某页前主动点「扫描此页」→ 勾选标注 → 生成用例 → 按用例测试 |
| D6 | 插件/Skill 职责切分 | **方案 3：分层插件 + Skill**。插件=采集/去噪/预分类（带 confidence），Skill=规则匹配/用例生成/风格对齐 |
| D7 | 语义树来源 | **CDP 直读**（chrome.debugger + Accessibility.getFullAXTree），DevTools 冲突时降级 |
| D8 | 用例粒度 | 全表单**共性规则合并**成一条用例，元素**个性规则独立**成案；每条用例带 rule_refs 追溯 |
| D9 | 勾选交互 | v0 对话勾选；契约预留 `selected` 字段，v1 插件 UI checkbox 直写（对 Skill 透明） |
| D10 | demo 用途 | **风格对齐**（结构/粒度/措辞/优先级习惯）；规则卡管覆盖维度，demo 管长相，两者不冲突 |

## 3. 系统架构

```
┌────────────────────────── 浏览器插件 ──────────────────────────┐
│ popup「扫描此页」→ background service worker（中枢）            │
│  ├─ CDP 采集层    chrome.debugger.attach(tab)                  │
│  │                Accessibility.getFullAXTree()                │
│  │                DOM.resolveNode(backendDOMNodeId) 补 DOM 属性  │
│  ├─ reducer       AXTree → 候选交互元素（过滤 ignored/装饰节点）  │
│  ├─ denoiser      可见性复核（AXTree 标记 + DOM 几何交叉验证）    │
│  ├─ classifier    role → interaction_type 映射 + confidence     │
│  └─ exporter      组装 inventory.json → File System Access 直写  │
└────────────────────────────────────────────────────────────┘
                    ↓ 文件契约（inventory.json）
┌────────────────────────── Comate Skill ────────────────────────┐
│ ① 裁决   低 confidence 元素 AI 终审；unclassified 猜测+建议      │
│ ② 匹配   内置标准卡 ← rules/*.yaml 覆写/追加 → 检查点清单        │
│ ③ 收敛一 用户确认检查点范围（对话勾选）                          │
│ ④ 组装   检查点 → 用例（共性合并/个性独立），分配优先级           │
│ ⑤ 对齐   demo few-shot 校正结构/措辞/粒度                        │
│ 输出：cases.md（人读）+ cases.json（机读，含追溯链）              │
└────────────────────────────────────────────────────────────┘
```

**工作流闭环**：扫描出清单 → 测试者勾选/标注 → Skill 分维度生成 → 每条用例可追溯 → 删改反馈回流成规则卡。

## 4. 数据契约

### 4.1 inventory.json（插件 → Skill，v0.1）

```jsonc
{
  "schema_version": "0.1",
  "meta": {
    "page_url": "https://…/login",
    "page_title": "登录页",
    "captured_at": "2026-09-14T11:30:00+08:00",
    "plugin_version": "0.1.0",
    "session_id": "2026-09-14_登录页"   // 未来多页串联时 flow 按此引用
  },
  "elements": [
    {
      "id": "e001",                       // 会话内稳定 ID
      "interaction_type": "text_input",   // 枚举见 4.2
      "label": "手机号",                  // 可见文案/aria-label/placeholder 取最优
      "hints": {
        "css_selector": "#phone",
        "aria_ref": "textbox-3",          // a11y tree 原生引用
        "placeholder": "请输入11位手机号"
      },
      "constraints": {                    // DOM 属性提取的确定性约束
        "required": true, "maxlength": null,
        "pattern": null, "input_type": "tel"
      },
      "visibility": "visible",
      "confidence": 0.95,                  // ≥0.9 直进清单，<0.9 交 Skill 裁决
      "selected": true,                   // 人工勾选
      "notes": ""                         // 人工备注
    }
  ],
  "unclassified": []                      // 启发式认不出的元素进这里，不丢弃
}
```

### 4.2 interaction_type 枚举（首期 ~12 种）

`text_input`、`textarea`、`select`、`radio`、`checkbox`、`button`、`link`、`file_upload`、`date_picker`、`pagination` 十种元素类；`dialog`、`tabs` 两个容器类。枚举宁可少而准，首期覆盖 80% 场景。radio/checkbox 首期复用 text_input 卡子集，二期独立。

### 4.3 关键契约原则

1. **interaction_type 与规则卡一一对应**——枚举是插件、Skill、规则卡三方共同语言。
2. **去噪是采集器的责任**——隐藏/装饰/aria-hidden 元素在插件侧过滤，不进 JSON；`unclassified` 保底原则：存疑的不删，没把握才降级。
3. **多页串联预留**——单文件自包含（一页面 = 一 session_id）；未来 flow 层 = `flow.json { steps: [{session_id, trigger_element_id}] }`，只在外面长新层，不改现有 Schema。
4. **disabled 元素保留但标注**——disabled 状态本身常值得测一条。

### 4.4 cases.json（Skill 产出，与 inventory 对称）

```jsonc
{
  "schema_version": "0.1",
  "meta": { "session_id": "2026-09-14_登录页", "generated_at": "…" },
  "cases": [
    {
      "id": "c001",
      "title": "登录提交-空表单校验",
      "priority": "P0",
      "preconditions": ["已打开登录页"],
      "steps": ["不填写任何字段，直接点击登录"],
      "expected": ["手机号/密码输入框下方提示必填，不发起请求"],
      "rule_refs": ["text-input-standard:empty-submit"],
      "element_ids": ["e001", "e002"],
      "style_source": "demo#2"
    }
  ],
  "coverage": { "elements_total": 12, "covered": 10,
                "skipped_reasons": {"e007": "selected=false"} },
  "rule_gaps": ["select 标准卡缺失", "date_picker 卡仅 1 条规则"]
}
```

### 4.5 规则卡 Schema（rules/*.yaml）

```yaml
id: text-input-standard
applies_to: text_input
rules:
  - id: boundary-min-max
    title: 边界值测试
    detail: 按 maxlength/minlength 取边界值及 ±1；无 maxlength 默认测 255/256
  - id: empty-submit
    title: 空值提交
  - id: whitespace-trim
    title: 前后空格处理
  - id: xss-injection
    title: 特殊字符与脚本注入
```

- 一张卡 = 一种 interaction_type；卡内 3~8 条规则维度，每条规则默认 1 条用例（受粒度策略重组）。
- 每条rule 可带 `priority` 默认值（如 empty-submit P0、whitespace-trim P2），Skill 按页面上下文微调（如登录提交相关全升 P0）。
- 双层体系：内置标准卡保底，项目 `rules/` 按 interaction_type 覆写或追加。
- **规则缺口清单**：某 interaction_type 无卡或卡很薄时，生成报告末尾列出——规则卡体系自我生长的入口。

## 5. 插件侧设计（CDP 直读路线）

### 5.1 选型理由

- 语义名（accname）、role、状态属性由浏览器算好，语义准确率高于手写 DOM 自算；
- open shadowRoot 在 AXTree 天然平铺，无需递归穿越；
- role → interaction_type 一张映射表搞定（权威语义，confidence 天然 0.95+）。

### 5.2 采集管线与生命周期

- 位置：background service worker（CDP 只能在 background 调 `chrome.debugger`）。
- 生命周期：attach → getFullAXTree → resolveNode 批量补属性（maxlength/pattern/type 等）→ **立刻 detach**，全程毫秒级；任何失败路径 try/finally detach，绝不挂连接。
- 按需轻量调用 `Runtime.evaluate`，采集期不注入常驻 content script。

### 5.3 必须处理的工程点

1. **Debugger 冲突降级**：attach 失败（用户开着 DevTools 或被占用）→ 明确报错引导关闭 DevTools 重试，并提供「兼容模式」退回 DOM 自算简化采集（复用同一份契约，语义名质量略降）。两条采集路，一份 Schema。
2. **清单落盘**：主路 File System Access API——首次弹目录选择器选中 `workspace/inventory/`，句柄存 IndexedDB，此后一键直写；备路下载导出/剪贴板兜底。
3. **清单爆炸控制**：popup 提供精简/完整两档；首期按 viewport 裁剪。

### 5.4 分类器与 confidence

| 证据 | interaction_type | confidence |
|------|-----------------|------------|
| AXTree role=textbox + input[type=tel] 等常规 | text_input 等 | 0.95（AI 不复审）|
| aria-haspopup=dialog / modal 出现 | dialog | 0.6（AI 终审）|
| contenteditable（可能是富文本） | textarea | 0.7（AI 终审）|
| 认不出 | → unclassified | 0（不丢弃）|

原则：**插件启发式只负责"省 AI 的活"，不替 AI 拍板**；≥0.9 直进清单，<0.9 标低信心交 Skill 裁决（裁决结论由 AI 说明理由，存疑项列表给用户确认）。

### 5.5 硬骨头首期策略

| 场景 | 首期处理 |
|------|----------|
| Shadow DOM | open 天然平铺；closed 采集不到，诚实标注 |
| 跨域 iframe | 占位标注；如需深入，对 iframe 单独 attach（一期后续） |
| 虚拟滚动长列表 | 只采当前视口已渲染项 + `virtualized_hint` |
| 富文本编辑器 | 整体识别为 textarea 一条 + 证据链，用例交给 AI 泛化 |
| canvas 内交互 | 明确 out of scope |

## 6. Skill 侧设计

### 6.1 生成管线（五步，一处主收敛 + 一处轻收敛）

```
输入：inventory.json + rules/*.yaml + demo/examples.md + 对话临时业务规则
① 裁决   低 confidence：AI 判型+理由；unclassified：猜测+建议卡，不自动纳入
② 匹配   内置卡 ← 项目卡覆写/追加 → 每个 selected 元素挂规则卡 → 检查点清单
③ 收敛一 用户确认检查点范围（v0 对话：AI 列摘要，回"全要/去掉几号"）
④ 组装   检查点 → 用例（粒度策略），分配优先级
⑤ 对齐   demo few-shot 校正 → 输出 cases.md + cases.json
```

### 6.2 用例粒度策略（D8）

| 规则性质 | 组装方式 | 例 |
|----------|----------|-----|
| 全表单共性规则（必填空值/XSS/超长） | 同区块合并一条，步骤列出涉及字段 | 「登录提交-空表单校验」覆盖 3 个必填项 |
| 元素个性规则（边界值/pattern/日期跨月） | 一元素一条独立成案 | 「手机号-11位边界校验」 |

每条用例头部带 `覆盖检查点 → rule_refs + element_ids`，可追溯。

### 6.3 两个加分设计

1. **临时业务规则沉淀**：对话中的特殊规则（"手机号必须11位"），本次生效外还生成 YAML 卡草稿建议存入 `rules/`——对话知识沉淀为团队资产。
2. **风格对齐**：demo/examples.md 提供测试者 2~3 条手写用例做 few-shot；cases.json 记 `style_source`。

## 7. 目录契约

```
workspace/
  inventory/2026-09-14_登录页/
    inventory.json        # 契约文件（插件产出）
    cases.json            # Skill 产出（中间资产）
    cases.md              # Skill 产出（人读）
  rules/                  # 项目级规则卡（YAML）
  demo/examples.md        # 测试者风格样例
```

## 8. 里程碑（各有可演示验收物）

| 里程碑 | 内容 | 验收标准 |
|--------|------|----------|
| **M0 竖切**（最优先） | 插件 CDP 采集 → inventory.json → Skill 匹配内置卡 → cases.md/cases.json；1 个真实页走通全链路 | 登录/注册页样本出 10~30 条用例，空值/边界/XSS 检查点齐全，每条可追溯 rule_refs |
| **M1 可用性** | 一键直写落盘；裁决对话打磨；去噪调优（3~5 个内部页对比） | 新手不看文档独立完成「扫描→勾选→出用例」 |
| **M2 学习闭环** | 临时规则→YAML 草稿；规则缺口报告；rules/ 完善流程 | 同页二次生成，质量因卡增厚可感知提升 |
| **M3 团队化**（远景） | 多维表/Excel 导出；多页 flow 串联；规则卡托管升级 | 按需再议 |

### 首期（M0+M1）范围

**做：**
- 单页快照采集（CDP 主路 + DevTools 冲突降级提示）
- 首批 5 张内置规则卡：text_input / select / button / file_upload / date_picker（M0）；v0.2.0 扩充至 12 张，覆盖 INTERACTION_TYPES 全部类型（radio/checkbox 等独立成卡，不再复用子集）
- cases.md + cases.json 带追溯链
- 对话勾选（v0）；契约预留 selected 直写（v1）
- 内置卡 + 项目 rules/ 双层规则体系

## 9. 未来路线图（当前不做，但架构预留）

> 以下条目**首期明确不做**（防范围蔓延），作为后续演进方向保留：

- **页面状态图 / 操作录像**——页面间状态转移与操作序列的可视化采集
- **多页串联执行的自动化**——flow.json 串联已做 Schema 预留（4.3-3）
- **closed shadowRoot / canvas / 跨域 iframe 深入采集**——当前诚实标注占位
- **云端 / 团队账号体系**——单机文件契约起步，云协作后置
- **测后补漏模式**（被动监听生成"未覆盖清单"）——测量差集本质仍是快照差集，与现架构不冲突
- **出口适配器扩展**——Excel/多维表/云文档直写（数据资产是 cases.json，出口只是皮）
- **规则卡多维表托管**——rules/ YAML 格式不变，只换存储

## 10. 风险与对策

| 风险 | 对策 |
|------|------|
| CDP 采集信息量大，清单爆炸 | 去噪阈值可配（精简/完整两档），首期按 viewport 裁剪 |
| AI 用例步骤不可执行（太抽象） | demo 风格对齐 + cases.json 保留 selector，人可落地 |
| "生成一堆没人看的用例" | 生成前强制人工收敛（勾选 + 检查点确认），宁少勿滥 |
| DevTools 占用 debugger | 冲突降级方案（5.3-1），两路采集一份契约 |
| 虚拟滚动/富文本等边界场景识别不准 | confidence 机制 + unclassified 兜底，AI 终审 |

## 11. 未决事项

- **采集触发场景的细节**：popup 单按钮已定，但快捷键/自动提示（检测到表单页主动建议扫描）留到 M1 体验打磨时定。
- **demo 用于风格对齐的用法细节**：首期整段 few-shot；是否提取结构模板（标题格式/优先级习惯的结构化解析）在 M2 评估。
