import type { ClassifiedElement, Inventory, InventoryElement, InventoryMeta } from './inventory';

export function buildInventory({
  meta, sure, review, unclassified,
}: {
  meta: InventoryMeta;
  sure: ClassifiedElement[];
  review: ClassifiedElement[];
  unclassified: ClassifiedElement[];
}): Inventory {
  const elements: InventoryElement[] = [...sure, ...review].map((c, i) => {
    const group = c.__group
      ? { kind: c.__group.kind, signature: c.__group.signature, member_count: c.__group.member_count ?? c.__group.memberCount ?? 1 }
      : undefined;
    return {
      id: `e${String(i + 1).padStart(3, '0')}`,
      interaction_type: c.interaction_type,
      label: c.name ?? '',
      hints: { css_selector: c.hints?.css_selector ?? null, aria_path: c.hints?.aria_path ?? null, placeholder: c.hints?.placeholder ?? null },
      constraints: { required: c.constraints?.required ?? null, maxlength: c.constraints?.maxlength ?? null, pattern: c.constraints?.pattern ?? null, input_type: c.constraints?.input_type ?? null, disabled: c.state?.disabled ?? false },
      visibility: c.visible === false ? 'hidden' : 'visible',
      confidence: c.confidence,
      selected: true,
      ...(group ? { group } : {}),
      notes: group ? `同类折叠：${group.member_count} 个同名近似元素合并由此代表` : '',
    };
  });
  return {
    schema_version: '0.1',
    meta: { ...meta, captured_at: new Date().toISOString() },
    elements,
    unclassified: (unclassified ?? []).map(c => ({ tempId: c.tempId, role: c.role, name: c.name ?? '' })),
  };
}
