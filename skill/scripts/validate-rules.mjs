// 规则卡校验与缺口台账(设计文档 docs/superpowers/specs/2026-09-29-m2-learning-loop-design.md §4/§6)
// Task 4 将在文件末尾追加 CLI 壳;本文件先只含纯函数与常量。
import { parseRuleCard } from './lib/rule-card-yaml.mjs';

// 与 extension/lib/constants.ts 逐字一致(skill 不 import 插件代码,此处复制是契约同步点,
// validate-rules.test.mjs 有逐字断言防止两处漂移)
export const INTERACTION_TYPES = Object.freeze([
  'text_input', 'textarea', 'select', 'radio', 'checkbox',
  'button', 'link', 'file_upload', 'date_picker', 'pagination',
  'dialog', 'tabs',
]);

const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PRIORITIES = new Set(['P0', 'P1', 'P2', 'P3']);

// 卡级语义校验;返回 [{line?, message}](无行号 = 卡级问题)
export function validateCard(card, builtinIds) {
  const errs = [];
  if (!card.id) errs.push({ message: '卡缺 id' });
  else if (!KEBAB_RE.test(card.id)) errs.push({ message: `卡 id 非 kebab-case: ${card.id}` });
  else if (builtinIds.has(card.id)) errs.push({ message: `卡 id 与内置卡冲突: ${card.id}` });

  if (!card.applies_to) errs.push({ message: '卡缺 applies_to' });
  else if (!INTERACTION_TYPES.includes(card.applies_to)) {
    errs.push({ message: `applies_to 不是合法 interaction_type: ${card.applies_to}` });
  }

  if (!Array.isArray(card.rules) || card.rules.length === 0) {
    errs.push({ message: 'rules 须为非空数组' });
    return errs;
  }

  const seen = new Set();
  card.rules.forEach((rule, i) => {
    const pos = rule.id ? `「${rule.id}」` : `规则 ${i + 1}`;
    if (!rule.id) errs.push({ message: `${pos} 缺 id` });
    else if (seen.has(rule.id)) errs.push({ message: `规则 id 重复: ${rule.id}` });
    else seen.add(rule.id);
    if (!rule.title) errs.push({ message: `${pos}缺 title` });
    if (rule.priority !== undefined && !PRIORITIES.has(rule.priority)) {
      errs.push({ message: `${pos} priority 非法(须 P0–P3): ${rule.priority}` });
    }
    if (rule.scope !== undefined) {
      const s = rule.scope ?? {};
      const keys = ['match_label', 'match_selector'];
      const hasAny = keys.some((k) => Array.isArray(s[k]));
      if (!hasAny) {
        errs.push({ message: `${pos} scope 须含 match_label 或 match_selector(flow 字符串数组)` });
      } else {
        for (const k of keys) {
          if (s[k] !== undefined && !Array.isArray(s[k])) {
            errs.push({ message: `${pos} scope.${k} 须为 flow 字符串数组` });
          } else if (Array.isArray(s[k]) && s[k].some((v) => typeof v !== 'string')) {
            errs.push({ message: `${pos} scope.${k} 含非字符串元素` });
          }
        }
      }
    }
  });
  return errs;
}

// ---- 缺口台账纯函数(spec §4.3)----

export const THIN_THRESHOLD = 3; // 卡内规则数 < 3 = thin(spec §4.2)

// 合并本次 rule_gaps 进台账:键 interaction_type+gap_type;
// 同键 → sessions 去重追加、detail/suggestion 覆盖、first_seen 保留;新键 → 追加。
// 纯函数,不修改入参。
export function mergeGaps(existing, incoming, sessionId) {
  const out = existing.map((g) => ({ ...g, sessions: [...(g.sessions ?? [])] }));
  for (const inc of incoming) {
    const hit = out.find(
      (g) => g.interaction_type === inc.interaction_type && g.gap_type === inc.gap_type
    );
    if (hit) {
      hit.detail = inc.detail;
      hit.suggestion = inc.suggestion;
      if (!hit.sessions.includes(sessionId)) hit.sessions.push(sessionId);
    } else {
      out.push({ ...inc, first_seen: sessionId, sessions: [sessionId] });
    }
  }
  return out;
}

// 按当前卡况(内置+项目合并后的 interaction_type → 规则数)清理台账:
// missing 且已有卡 → 移除;thin 且规则数 ≥ 阈值 → 移除;其余保留。纯函数。
export function resolveGaps(gaps, counts) {
  return gaps.filter((g) => {
    const n = counts.get(g.interaction_type) ?? 0;
    if (g.gap_type === 'missing') return n === 0;
    return g.gap_type === 'thin' ? n < THIN_THRESHOLD : true;
  });
}
