const MAPPABLE_ROLES = new Set([
  'textbox', 'combobox', 'listbox', 'radio', 'checkbox', 'button',
  'link', 'menuitemcheckbox', 'menuitemradio', 'searchbox',
]);

// AXTree → 候选交互元素：role 可映射、未忽略、且无可映射交互后代的节点
// （按钮内常包 staticText 子节点，不能用“叶子”判定；列表类容器由最内层可交互节点代表）
export function reduceAxtree(nodes) {
  const byId = new Map(nodes.filter(Boolean).map(n => [n.nodeId, n]));
  const mappable = (n) => !!n && !n.ignored && n.role?.type === 'role' && MAPPABLE_ROLES.has(n.role.value);
  const memo = new Map();
  function hasMappableDesc(id) {
    if (memo.has(id)) return memo.get(id);
    memo.set(id, false); // 防环
    const n = byId.get(id);
    let r = false;
    for (const c of (n?.childIds ?? [])) {
      if (mappable(byId.get(c)) || hasMappableDesc(c)) { r = true; break; }
    }
    memo.set(id, r);
    return r;
  }
  return nodes.filter(n =>
    n && !n.ignored &&
    n.role && n.role.type === 'role' && MAPPABLE_ROLES.has(n.role.value) &&
    !hasMappableDesc(n.nodeId)
  ).map(n => ({
    backendDOMNodeId: n.backendDOMNodeId ?? null,
    role: n.role.value,
    name: n.name?.value ?? '',
    ignored: false,
    properties: Array.isArray(n.properties) ? n.properties : [],
  }));
}
