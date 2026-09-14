const MAPPABLE_ROLES = new Set([
  'textbox', 'combobox', 'listbox', 'radio', 'checkbox', 'button',
  'link', 'menuitemcheckbox', 'menuitemradio', 'searchbox',
]);

// AXTree → 候选交互元素：只挑 role 可映射、未忽略的叶子节点
export function reduceAxtree(nodes) {
  return nodes.filter(n =>
    n && !n.ignored &&
    n.role && n.role.type === 'role' && MAPPABLE_ROLES.has(n.role.value) &&
    (n.childIds ?? []).length === 0
  ).map(n => ({
    backendDOMNodeId: n.backendDOMNodeId ?? null,
    role: n.role.value,
    name: n.name?.value ?? '',
    ignored: false,
    properties: Array.isArray(n.properties) ? n.properties : [],
  }));
}
