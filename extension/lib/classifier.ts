import { CONF_HIGH, CONF_THRESHOLD } from './constants';
import type { InteractionType } from './constants';
import type { Candidate, ClassifiedElement, EnrichedCandidate } from './inventory';

const propOf = (c: Candidate, name: string): unknown =>
  c.properties.find(p => p.name === name)?.value?.value;

const ROLE_TO_TYPE: Record<string, InteractionType> = {
  textbox: 'text_input',
  searchbox: 'text_input',
  combobox: 'select',
  listbox: 'select',
  button: 'button',
  link: 'link',
  radio: 'radio',
  checkbox: 'checkbox',
  tab: 'tabs',
  switch: 'checkbox', // 开关是布尔选择，checkbox 规则卡（独立切换/默认态）适用
  menuitem: 'button',
  menuitemcheckbox: 'checkbox',
  menuitemradio: 'radio',
};

// readonly 文本框 + 日期/时间占位符 → 日期类选择器（antd DatePicker/TimePicker 渲染为 readonly textbox，
// 原生 input[type=date] 在上面 input_type 分支处理）。0.6 低信心，进 review 由 Skill 裁决。
const PICKER_PLACEHOLDER = /日期|时间|date|time/i;

// 入参带 Partial<EnrichedCandidate>：classify 只读 constraints（enrich 在 background 管线中已补齐），
// 产出对象为 "spread candidate + 追加字段"，即原 JS 实现的等价形态，故用 as 断言为 ClassifiedElement。
export function classify(candidates: (Candidate & Partial<EnrichedCandidate>)[]): ClassifiedElement[] {
  let tempId = 0;
  return candidates.map(c => {
    const t = c.constraints?.input_type;
    let interaction_type: InteractionType | null = null;
    let confidence = 0;
    if (t === 'file') { interaction_type = 'file_upload'; confidence = CONF_HIGH; }
    else if (t === 'date') { interaction_type = 'date_picker'; confidence = CONF_HIGH; }
    else if (c.role === 'textbox') {
      // 占位符含日期/时间语义 → 日期类选择器（antd DatePicker/TimePicker 渲染为普通 textbox，
      // input 默认可编辑所以无法用 readonly 区分；原生 input[type=date] 在上面 input_type 分支处理）。
      // 0.6 低信心进 review 由 Skill 裁决，误报代价可控。
      if (PICKER_PLACEHOLDER.test(c.hints?.placeholder ?? '')) {
        interaction_type = 'date_picker';
        confidence = 0.6;
      } else {
        interaction_type = propOf(c, 'multiline') ? 'textarea' : 'text_input';
        confidence = CONF_HIGH;
      }
    } else if (ROLE_TO_TYPE[c.role]) {
      interaction_type = ROLE_TO_TYPE[c.role]!;
      confidence = CONF_HIGH;
    }
    if (interaction_type === null && /页|分页/.test(c.name)) { interaction_type = 'pagination'; confidence = 0.6; }
    return { tempId: ++tempId, interaction_type, confidence, ...c } as ClassifiedElement;
  });
}

// ≥0.9 直进清单；<0.9 标低信心交 Skill；0=认不出 → unclassified
export function splitByConfidence(classified: ClassifiedElement[]): [
  ClassifiedElement[], ClassifiedElement[], ClassifiedElement[],
] {
  const sure: ClassifiedElement[] = [], review: ClassifiedElement[] = [], unclassified: ClassifiedElement[] = [];
  for (const c of classified) {
    if (!c.interaction_type || c.confidence === 0) unclassified.push(c);
    else if (c.confidence >= CONF_THRESHOLD) sure.push(c);
    else review.push(c);
  }
  return [sure, review, unclassified];
}
