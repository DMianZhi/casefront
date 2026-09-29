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

// ---- 文件层与 CLI(spec §6)----
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const BUILTIN_DIR_DEFAULT = join(dirname(fileURLToPath(import.meta.url)), '..', 'references', 'rules');

// 读目录下全部 *.yaml 的卡 id(解析失败的卡跳过)
export function loadBuiltinCardIds(builtinDir) {
  const ids = new Set();
  if (!existsSync(builtinDir)) return ids;
  for (const f of readdirSync(builtinDir).filter((f) => f.endsWith('.yaml'))) {
    const { card, errors } = parseRuleCard(readFileSync(join(builtinDir, f), 'utf8'));
    if (errors.length === 0 && card.id) ids.add(card.id);
  }
  return ids;
}

// 读单张卡文件 → { file, card, errors }
function loadCardFile(path) {
  const { card, errors } = parseRuleCard(readFileSync(path, 'utf8'));
  return { file: path, card, errors };
}

// validate 子命令:校验 rulesDir 正式区 + drafts/ 草稿区
export function runValidate(rulesDir, builtinDir = BUILTIN_DIR_DEFAULT) {
  const report = [];
  let ok = true;
  const builtinIds = loadBuiltinCardIds(builtinDir);
  // 自检模式:rulesDir 就是内置目录时跳过内置冲突检查(否则每张卡都与自己冲突)
  if (resolve(rulesDir) === resolve(builtinDir)) builtinIds.clear();
  const seenIds = new Map(); // 卡 id → 文件(正式区)
  const draftIds = new Map();

  const zones = [
    { dir: rulesDir, label: '', dupMap: seenIds },
    { dir: join(rulesDir, 'drafts'), label: 'drafts/', dupMap: draftIds },
  ];
  let checked = 0;
  for (const zone of zones) {
    if (!existsSync(zone.dir)) continue;
    for (const f of readdirSync(zone.dir).filter((f) => f.endsWith('.yaml')).sort()) {
      const path = join(zone.dir, f);
      const { card, errors } = loadCardFile(path);
      checked++;
      for (const e of errors) {
        ok = false;
        report.push(`${zone.label}${f}:${e.line}: ${e.message}`);
      }
      for (const e of validateCard(card, builtinIds)) {
        ok = false;
        report.push(`${zone.label}${f}:${e.line ?? 1}: ${e.message}`);
      }
      if (card.id) {
        if (zone.dupMap.has(card.id)) {
          ok = false;
          report.push(`${zone.label}${f}:1: 卡 id 重复: ${card.id}(另见 ${zone.dupMap.get(card.id)})`);
        } else {
          zone.dupMap.set(card.id, `${zone.label}${f}`);
        }
      }
    }
  }
  // 草稿与正式卡同 id = 告警(入库语义是追加/更新,不算失败)
  for (const [id, where] of draftIds) {
    if (seenIds.has(id)) report.push(`告警:${where} 与正式卡 ${seenIds.get(id)} 同 id(入库时将走更新语义)`);
  }
  if (ok) return { ok, report: `✓ ${checked} 张卡校验通过` };
  return { ok, report: report.join('\n') };
}

// gaps 子命令:读台账(+可选 --from 合并本次缺口)→ 按当前卡清理 → 写回
// opts.builtinDir 可注入内置目录(单测用 fixture,生产用默认真实内置卡目录)
export function runGaps(workspaceDir, { from, builtinDir = BUILTIN_DIR_DEFAULT } = {}) {
  const rulesDir = join(workspaceDir, 'rules');
  const gapsPath = join(rulesDir, 'gaps.json');

  let book = { schema_version: '0.1', gaps: [] };
  let bookExists = existsSync(gapsPath);
  if (bookExists) {
    try {
      book = JSON.parse(readFileSync(gapsPath, 'utf8'));
    } catch (e) {
      return { ok: false, report: `gaps.json 损坏(${e.message}),请人工决定修复或重建——不静默覆盖跨会话台账`, remaining: -1 };
    }
  }

  let gaps = Array.isArray(book.gaps) ? book.gaps : [];
  let sessionId = '';
  if (from) {
    const cases = JSON.parse(readFileSync(from, 'utf8'));
    sessionId = cases.meta?.session_id ?? '';
    gaps = mergeGaps(gaps, cases.rule_gaps ?? [], sessionId);
  }

  // 规则数计数:内置卡 + 项目正式卡(草稿不计),按 applies_to 合并
  const counts = new Map();
  const bump = (dir) => {
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.yaml'))) {
      const { card, errors } = loadCardFile(join(dir, f));
      if (errors.length || !card.applies_to) continue;
      counts.set(card.applies_to, (counts.get(card.applies_to) ?? 0) + (card.rules?.length ?? 0));
    }
  };
  bump(builtinDir);
  bump(rulesDir);

  const remaining = resolveGaps(gaps, counts);
  const changed = !bookExists || remaining.length !== gaps.length ||
    JSON.stringify(remaining) !== JSON.stringify(gaps);
  if (changed) {
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(gapsPath, JSON.stringify({ schema_version: '0.1', gaps: remaining }, null, 2) + '\n', 'utf8');
  }

  const lines = [`缺口台账:${remaining.length} 条未补齐${changed ? '(已写回 gaps.json)' : '(无变化,未写盘)'}`];
  for (const g of remaining) {
    lines.push(`- [${g.gap_type}] ${g.interaction_type}:${g.detail} → ${g.suggestion}(首见 ${g.first_seen},${g.sessions.length} 个会话)`);
  }
  return { ok: true, report: lines.join('\n'), remaining: remaining.length };
}

// ---- CLI 入口 ----
function main() {
  const [, , cmd, arg, ...rest] = process.argv;
  const flag = (name) => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  if (cmd === 'validate') {
    const r = runValidate(resolve(arg ?? 'workspace/rules'), resolve(rest[0] ?? BUILTIN_DIR_DEFAULT));
    console.log(r.report);
    process.exitCode = r.ok ? 0 : 1;
  } else if (cmd === 'gaps') {
    const fromFlag = flag('--from');
    const r = runGaps(resolve(arg ?? 'workspace'), { from: fromFlag ? resolve(fromFlag) : undefined });
    console.log(r.report);
    process.exitCode = r.ok ? 0 : 1;
  } else {
    console.log('用法: validate-rules.mjs validate [rulesDir] [builtinDir] | gaps [workspaceDir] [--from cases.json]');
    process.exitCode = 1;
  }
}

// 直接执行时进 CLI,被 import(测试)时不执行
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
