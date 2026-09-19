import type { InteractionType } from './constants';

// ---- CDP aXTree 属性（reducer/classifier 用到的最小子集）----
export interface AxProperty {
  name: string;
  value: { type: string; value: unknown };
}

// ---- 候选元素家族（内部管线类型，非契约）----
export interface Candidate {
  backendDOMNodeId: number | string | null;
  role: string;
  name: string;
  ignored: boolean;
  properties: AxProperty[];
  parentId?: string | null;
  bounds?: { width?: number; height?: number };
}

export interface ElementHints {
  css_selector: string | null;
  aria_path: string | null;
  placeholder: string | null;
}

export interface ElementConstraints {
  required: boolean | null;
  maxlength: number | null;
  pattern: string | null;
  input_type: string | null;
  /** 仅内部管线使用（antd 日期/时间控件识别启发式）；导出契约不含该字段 */
  readonly?: boolean | null;
  disabled: boolean;
}

export interface EnrichedCandidate extends Candidate {
  hints: ElementHints;
  constraints: ElementConstraints;
  visible: boolean;
  state: { disabled: boolean };
}

export interface GroupInfo {
  kind: 'prefix' | 'suffix';
  signature: string;
  member_count?: number;
  memberCount?: number;
}

export interface ClassifiedElement extends EnrichedCandidate {
  tempId: number;
  interaction_type: InteractionType | null;
  confidence: number;
  __group?: GroupInfo;
}

// ---- inventory.json 契约（schema_version 0.1，设计文档 §4.1）----
export interface ElementGroup {
  kind: 'prefix' | 'suffix';
  signature: string;
  member_count: number;
}

export interface InventoryElement {
  id: string;
  interaction_type: InteractionType | null;
  label: string;
  hints: ElementHints;
  constraints: ElementConstraints;
  visibility: 'visible' | 'hidden';
  confidence: number;
  selected: boolean;
  group?: ElementGroup;
  notes: string;
}

export interface InventoryMeta {
  page_url: string;
  page_title: string;
  session_id: string;
  plugin_version: string;
  scan_mode: 'compact' | 'full';
  captured_at?: string;
  exported_at?: string;
}

export interface UnclassifiedItem {
  tempId: number;
  role: string;
  name: string;
}

export interface Inventory {
  schema_version: '0.1';
  session_id?: string;
  meta: InventoryMeta;
  elements: InventoryElement[];
  unclassified: UnclassifiedItem[];
}
