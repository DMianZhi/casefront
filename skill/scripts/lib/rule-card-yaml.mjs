// 规则卡受控 YAML 的最小解析器(设计文档 docs/superpowers/specs/2026-09-29-m2-learning-loop-design.md §4.1/§6)
// 只支持约定结构:顶层 id/applies_to/rules 列表、规则字段、scope(match_label/match_selector)。
// 解析不抛异常,全部失败走 errors[{line,message}]——调用方必须先检查 errors 再用 card。

export function parseRuleCard(text) {
  const errors = [];
  const card = { id: '', applies_to: '', rules: [] };
  let curRule = null;
  let inScope = false;

  const stripQuotes = (s) => {
    const t = s.trim();
    if (t.length >= 2 && ((t[0] === '"' && t.at(-1) === '"') || (t[0] === "'" && t.at(-1) === "'"))) {
      return t.slice(1, -1);
    }
    return t;
  };

  const parseValue = (raw, lineNo) => {
    const t = raw.trim();
    if (t === '') return { scalar: '' };
    if (t.startsWith('[')) {
      if (!t.endsWith(']')) {
        errors.push({ line: lineNo, message: `数组未闭合: ${t}` });
        return { array: [] };
      }
      const inner = t.slice(1, -1).trim();
      // 受控约定:数组元素不得含逗号(带逗号的值须换表达方式),split 即安全
      return { array: inner ? inner.split(',').map(stripQuotes) : [] };
    }
    if (t.includes(': ') && !t.startsWith('"') && !t.startsWith("'")) {
      errors.push({ line: lineNo, message: `值含歧义冒号,请加引号: ${t}` });
      return { scalar: '' };
    }
    return { scalar: stripQuotes(t) };
  };

  const KEY_RE = /^(?:-\s+)?([A-Za-z][\w-]*):\s*(.*)$/;

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i].replace(/\t/g, '  ');
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();
    const isItem = trimmed.startsWith('- ');
    const m = trimmed.match(KEY_RE);
    if (!m) {
      errors.push({ line: lineNo, message: `无法解析的行: ${trimmed}` });
      continue;
    }
    const [, key, rest] = m;

    // 缩进 0:顶层键
    if (indent === 0 && !isItem) {
      inScope = false;
      if (key === 'rules') continue;
      if (key === 'id' || key === 'applies_to') {
        card[key] = parseValue(rest, lineNo).scalar ?? '';
      } else {
        errors.push({ line: lineNo, message: `未知顶层键: ${key}` });
      }
      continue;
    }

    // 缩进 2:新列表项(规则)
    if (isItem) {
      if (indent !== 2) {
        errors.push({ line: lineNo, message: `列表项缩进须为 2 空格,实际 ${indent}` });
        continue;
      }
      curRule = {};
      card.rules.push(curRule);
      inScope = false;
      if (rest !== '') {
        const v = parseValue(rest, lineNo);
        if (v.scalar !== undefined) curRule[key] = v.scalar;
        else errors.push({ line: lineNo, message: `列表项首行不支持数组值: ${key}` });
      }
      continue;
    }

    // 缩进 4:规则字段(scope: 开启嵌套块)
    if (indent === 4 && curRule) {
      inScope = false;
      if (key === 'scope') {
        if (rest !== '') {
          errors.push({ line: lineNo, message: 'scope 须为嵌套块(match_label/match_selector),不支持行内值' });
        } else {
          curRule.scope = {};
          inScope = true;
        }
      } else {
        const v = parseValue(rest, lineNo);
        if (v.array !== undefined) curRule[key] = v.array;
        else curRule[key] = v.scalar;
      }
      continue;
    }

    // 缩进 6:scope 字段
    if (indent === 6 && curRule && inScope) {
      if (key === 'match_label' || key === 'match_selector') {
        const v = parseValue(rest, lineNo);
        if (v.array !== undefined) curRule.scope[key] = v.array;
        else errors.push({ line: lineNo, message: `${key} 须为 flow 数组` });
      } else {
        errors.push({ line: lineNo, message: `scope 下未知键: ${key}` });
      }
      continue;
    }

    errors.push({ line: lineNo, message: `缩进 ${indent} 不符合约定(0/2/4/6)` });
  }
  return { card, errors };
}
