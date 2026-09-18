import type { InventoryElement } from './inventory';

export type Selections = Record<string, boolean> | Map<string, boolean>;

function selectionHas(selections: Selections, id: string): boolean {
  return selections instanceof Map
    ? selections.has(id)
    : Object.prototype.hasOwnProperty.call(selections, id);
}
function selectionGet(selections: Selections, id: string): boolean | undefined {
  return selections instanceof Map ? selections.get(id) : selections[id];
}

export function applySelections(elements: InventoryElement[], selections: Selections): InventoryElement[] {
  if (selections == null || typeof selections !== 'object') {
    throw new TypeError('selections 必须是对象或 Map');
  }
  return elements.map(el =>
    selectionHas(selections, el.id) ? { ...el, selected: Boolean(selectionGet(selections, el.id)) } : el,
  );
}

// 新清单 vs 上次已勾选清单：同 id 继承勾选；新元素默认 true（存疑不删）
export function reconcileElements(
  next: InventoryElement[],
  prev: InventoryElement[] | null | undefined,
): InventoryElement[] {
  if (!Array.isArray(prev) || prev.length === 0) {
    return (next ?? []).map(el => ({ ...el, selected: true }));
  }
  const prevSel = new Map(
    prev.filter(e => e && e.id != null).map(e => [e.id, Boolean(e.selected)]),
  );
  return (next ?? []).map(el => ({
    ...el,
    selected: prevSel.has(el.id) ? prevSel.get(el.id)! : true,
  }));
}
