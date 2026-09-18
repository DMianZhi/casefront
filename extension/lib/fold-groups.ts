import type { Candidate } from './inventory';

export interface FoldGroup {
  kind: 'prefix' | 'suffix';
  signature: string;
  role: string;
  representative: Candidate;
  memberCount: number;
  members: Candidate[];
}

const NAME_PREFIX_MIN = 2;

function commonPrefix(names: string[]): string {
  if (names.length === 0) return '';
  let prefix = names[0]!;
  for (const n of names) {
    let i = 0;
    while (i < prefix.length && i < n.length && prefix[i] === n[i]) i++;
    prefix = prefix.slice(0, i);
    if (prefix.length < NAME_PREFIX_MIN) return '';
  }
  return prefix;
}

function lastToken(name?: string): string {
  const n = name ?? '';
  return n.includes(' ') ? n.split(' ').pop()! : n;
}

function makeGroup(kind: 'prefix' | 'suffix', signature: string, members: Candidate[]): FoldGroup {
  return {
    kind,
    signature,
    role: members[0]!.role,
    representative: members[0]!,
    memberCount: members.length,
    members,
  };
}

type FoldableNode = Candidate & { name: string; role: string };

export function foldGroups(
  nodes: FoldableNode[],
  { mode = 'compact', minSiblings = 5 }: { mode?: 'compact' | 'full'; minSiblings?: number } = {},
): { singles: FoldableNode[]; groups: FoldGroup[] } {
  if (mode === 'full' || !Array.isArray(nodes) || nodes.length === 0) {
    return { singles: Array.isArray(nodes) ? [...nodes] : [], groups: [] };
  }

  // 按父节点分组（null 也算一组）
  const byParent = new Map<string | null, FoldableNode[]>();
  for (const n of nodes) {
    const key = n.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(n);
  }

  const singles: FoldableNode[] = [], groups: FoldGroup[] = [];
  for (const siblings of byParent.values()) {
    if (siblings.length < minSiblings) { singles.push(...siblings); continue; }

    // 同父达标 → 按角色细分
    const byRole = new Map<string, FoldableNode[]>();
    for (const n of siblings) {
      if (!byRole.has(n.role)) byRole.set(n.role, []);
      byRole.get(n.role)!.push(n);
    }

    for (const bucket of byRole.values()) {
      if (bucket.length < minSiblings) { singles.push(...bucket); continue; }

      // 策略 1：公共前缀 —— 与簇代表名的公共前缀 ≥ NAME_PREFIX_MIN 即并入（贪心聚类）
      const clusters: { rep: string; arr: FoldableNode[] }[] = [];
      for (const n of bucket) {
        const name = n.name ?? '';
        let placed = false;
        for (const c of clusters) {
          if (commonPrefix([c.rep, name]).length >= NAME_PREFIX_MIN) { c.arr.push(n); placed = true; break; }
        }
        if (!placed) clusters.push({ rep: name, arr: [n] });
      }
      const leftovers: FoldableNode[] = [];
      for (const c of clusters) {
        // 组前缀按全体成员重算；重算后不合格（如混入异类）→ 降级进 leftovers，存疑不删
        const prefix = commonPrefix(c.arr.map(n => n.name ?? ''));
        if (prefix.length >= NAME_PREFIX_MIN && c.arr.length >= minSiblings) {
          groups.push(makeGroup('prefix', prefix, c.arr));
        } else {
          leftovers.push(...c.arr);
        }
      }

      // 策略 2（对前缀策略的漏网者）：尾 token 相同 → 等价类折叠
      const bySuffix = new Map<string, FoldableNode[]>();
      for (const n of leftovers) {
        const t = lastToken(n.name);
        if (!bySuffix.has(t)) bySuffix.set(t, []);
        bySuffix.get(t)!.push(n);
      }
      for (const [t, arr] of bySuffix) {
        if (arr.length >= minSiblings) {
          groups.push(makeGroup('suffix', t, arr));
        } else {
          singles.push(...arr);
        }
      }
    }
  }
  return { singles, groups };
}
