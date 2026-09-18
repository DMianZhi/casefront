import { describe, expect, it } from 'vitest';
import { CONF_HIGH, CONF_LOW, CONF_THRESHOLD, INTERACTION_TYPES } from '../lib/constants';
import type { InteractionType } from '../lib/constants';

describe('constants', () => {
  it('12 个交互类型，与 skill 规则卡一一对应', () => {
    expect(INTERACTION_TYPES).toHaveLength(12);
    expect([...INTERACTION_TYPES]).toEqual(['text_input', 'textarea', 'select', 'radio', 'checkbox', 'button', 'link', 'file_upload', 'date_picker', 'pagination', 'dialog', 'tabs']);
    expect(INTERACTION_TYPES).toContain('text_input');
    expect(INTERACTION_TYPES).toContain('tabs');
  });
  it('置信度常量不变', () => {
    expect(CONF_THRESHOLD).toBe(0.9);
    expect(CONF_HIGH).toBe(0.95);
    expect(CONF_LOW).toBe(0.6);
  });
  it('InteractionType 联合与数组同源（类型级检查，运行期取样验证）', () => {
    const t: InteractionType = INTERACTION_TYPES[0]!;
    expect(INTERACTION_TYPES).toContain(t);
  });
});
