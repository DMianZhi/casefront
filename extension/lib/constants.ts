export const INTERACTION_TYPES = Object.freeze([
  'text_input', 'textarea', 'select', 'radio', 'checkbox',
  'button', 'link', 'file_upload', 'date_picker', 'pagination',
  'dialog', 'tabs',
] as const) satisfies readonly string[];

export type InteractionType = (typeof INTERACTION_TYPES)[number];
export const CONF_THRESHOLD = 0.9;
export const CONF_HIGH = 0.95;
export const CONF_LOW = 0.6;
