// 从 cases.md 组装契约级 cases.json（SKILL.md 第 4/5 步的机器可读产物）
// 前置：scan-output/inventory.json 与 scan-output/cases.md 已存在；规则卡在 skill/references/rules/
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const inv = JSON.parse(readFileSync('scan-output/inventory.json', 'utf8'));
const md = readFileSync('scan-output/cases.md', 'utf8').replace(/\r\n/g, '\n'); // Windows 行尾归一化，前瞻匹配依赖 \n

// 规则卡清单（用于追溯校验）；cwd 应为 extension/，skill 在仓库根
const RULES_DIR = new URL('../../skill/references/rules/', import.meta.url);
const cards = {};
for (const f of readdirSync(RULES_DIR)) {
  const y = readFileSync(new URL(f, RULES_DIR), 'utf8');
  const cardId = y.match(/^id: (.+)$/m)[1].trim();
  cards[cardId] = new Set([...y.matchAll(/^ {2}- id: (.+)$/gm)].map(m => m[1].trim()));
}

const blocks = md.split(/^## /m).slice(1).filter(b => /^c\d+ /.test(b));
const grab = (b, k) => {
  // 最后一个字段后无行首标记（块在 ## 前被切断），前瞻须含块尾
  const m = b.match(new RegExp(`- \\*\\*${k}\\*\\*：([\\s\\S]*?)(?=\\n- \\*\\*|\\n##|\\n---|$)`));
  return m ? m[1].trim() : '';
};
const lines = s => s.split(/[；;]/).map(x => x.replace(/^[-\s]+/, '').trim()).filter(Boolean);

const cases = blocks.map(b => {
  const titleM = b.match(/^(c\d+) (.+?) P(\d)$/m) ?? b.match(/^(c\d+) (.+?) P(\d)/);
  return {
    id: titleM[1],
    title: titleM[2],
    priority: `P${titleM[3]}`,
    preconditions: lines(grab(b, '前置')),
    steps: lines(grab(b, '步骤')),
    expected: lines(grab(b, '预期')),
    rule_refs: grab(b, '规则').split(/[；;]/).map(s => s.trim()),
    element_ids: grab(b, '元素').trim().split(/\s+/).filter(Boolean),
    style_source: null, // demo/examples.md 未填，无风格来源
  };
});

// 追溯校验（SKILL.md 纪律：缺 rule_refs/element_ids 或引用无效即失败）
const validIds = new Set(inv.elements.map(e => e.id));
for (const c of cases) {
  if (!c.rule_refs.length || !c.element_ids.length) throw new Error(`${c.id} 缺 rule_refs 或 element_ids`);
  for (const ref of c.rule_refs) {
    const [card, rule] = ref.split(':');
    if (!cards[card]) throw new Error(`${c.id} 规则卡不存在: ${card}`);
    if (!cards[card].has(rule)) throw new Error(`${c.id} 卡 ${card} 无规则 ${rule}`);
  }
  for (const eid of c.element_ids) {
    if (!validIds.has(eid)) throw new Error(`${c.id} 元素不存在: ${eid}`);
  }
}

const covered = new Set(cases.flatMap(c => c.element_ids));
cases.sort((a, b) => a.id.localeCompare(b.id)); // md 中插入的用例重排回 id 序
const skipped = {};
for (const e of inv.elements) if (!covered.has(e.id)) skipped[e.id] = 'disabled：无交互用例价值';

const out = {
  schema_version: '0.1',
  meta: {
    session_id: inv.meta.session_id,
    source_page: inv.meta.page_url,
    generated_by: 'casefront-skill',
    generated_at: new Date().toISOString(),
    inventory_elements: inv.elements.length,
  },
  cases,
  coverage: { elements_total: inv.elements.length, covered: covered.size, skipped_reasons: skipped },
  rule_gaps: [
    { gap: 'TimePicker 套用 date-picker 卡，缺时间类规则（非法时间/12-24 小时制）', suggestion: '新增 time_picker 维度或为 date-picker 卡补 time 规则' },
    { gap: 'AutoComplete 联想输入（e016）套用 select 卡，option-roundtrip 不贴合联想场景', suggestion: '新增 autocomplete 规则卡（联想触发/键盘选择/失焦行为）' },
    { gap: '系统文件选择对话框无法自动化', suggestion: 'file-upload 卡注明手动验证边界' },
    { gap: '折叠组代表元素展开后的成员同质性无规则覆盖', suggestion: '新增 group-expand 检查规则' },
  ],
};

writeFileSync('scan-output/cases.json', JSON.stringify(out, null, 2), 'utf8');
console.log(`cases.json：${cases.length} 条用例；coverage ${covered.size}/${inv.elements.length}；追溯校验全部通过`);
