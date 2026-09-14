import { CONF_HIGH, CONF_THRESHOLD } from './constants.js';

const propOf = (c, name) => c.properties.find(p => p.name === name)?.value?.value;

export function classify(candidates) {
  let tempId = 0;
  return candidates.map(c => {
    const t = c.constraints?.input_type;
    let interaction_type = null, confidence = 0;
    if (t === 'file') { interaction_type = 'file_upload'; confidence = CONF_HIGH; }
    else if (t === 'date') { interaction_type = 'date_picker'; confidence = CONF_HIGH; }
    else if (c.role === 'textbox') {
      interaction_type = propOf(c, 'multiline') ? 'textarea' : 'text_input'; confidence = CONF_HIGH;
    } else if (c.role === 'combobox' || c.role === 'listbox') { interaction_type = 'select'; confidence = CONF_HIGH; }
    else if (c.role === 'button') { interaction_type = 'button'; confidence = CONF_HIGH; }
    else if (c.role === 'link') { interaction_type = 'link'; confidence = CONF_HIGH; }
    else if (c.role === 'radio') { interaction_type = 'radio'; confidence = CONF_HIGH; }
    else if (c.role === 'checkbox') { interaction_type = 'checkbox'; confidence = CONF_HIGH; }
    if (interaction_type === null && /页|分页/.test(c.name)) { interaction_type = 'pagination'; confidence = 0.6; }
    return { tempId: ++tempId, interaction_type, confidence, ...c };
  });
}

// ≥0.9 直进清单；<0.9 标低信心交 Skill；0=认不出 → unclassified
export function splitByConfidence(classified) {
  const sure = [], review = [], unclassified = [];
  for (const c of classified) {
    if (!c.interaction_type || c.confidence === 0) unclassified.push(c);
    else if (c.confidence >= CONF_THRESHOLD) sure.push(c);
    else review.push(c);
  }
  return [sure, review, unclassified];
}
