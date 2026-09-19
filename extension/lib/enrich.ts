import type { DebuggerSend, CallFunctionOnResult, ResolveNodeResult } from './cdp-types';
import type { EnrichedCandidate } from './inventory';

let enrichSeq = 0;

// 每次扫描开始时重置（fallback id 计数从 alt-1 重新开始）
export function resetEnrichSeq(): void {
  enrichSeq = 0;
}

// 逐候选补 DOM 属性与几何。补属性失败不阻塞：诚实降级为无约束（visible 保持 true）
export async function enrich(candidate: EnrichedCandidate, send: DebuggerSend): Promise<EnrichedCandidate> {
  const out: EnrichedCandidate = {
    ...candidate,
    hints: { css_selector: null, aria_path: null, placeholder: null },
    constraints: { required: null, maxlength: null, pattern: null, input_type: null, readonly: null, disabled: false },
    visible: true,
    bounds: undefined,
  };
  try {
    const resolved: ResolveNodeResult = await send('DOM.resolveNode', { backendNodeId: candidate.backendDOMNodeId });
    const obj = resolved?.object;
    if (obj?.objectId) {
      const evalr: CallFunctionOnResult = await send('Runtime.callFunctionOn', {
        objectId: obj.objectId,
        returnByValue: true,
        functionDeclaration: `function () {
          const el = this;
          const r = el.getBoundingClientRect();
          return {
            tag: el.tagName, input_type: el.getAttribute('type'), required: el.required ?? null,
            maxlength: el.maxLength && el.maxLength > 0 ? el.maxLength : null, pattern: el.getAttribute('pattern'),
            placeholder: el.getAttribute('placeholder'), readonly: el.readOnly ?? null,
            width: r.width, height: r.height,
            rect_visible: r.width > 0 && r.height > 0,
            has_file_input: !!(el.querySelector && el.querySelector('input[type=file]'))
          };
        }`,
      });
      const d = (evalr?.result?.value ?? {}) as Partial<{
        tag: string; input_type: string | null; required: boolean | null; maxlength: number | null;
        pattern: string | null; placeholder: string | null; readonly: boolean | null;
        width: number; height: number; rect_visible: boolean; has_file_input: boolean;
      }>;
      out.constraints = {
        input_type: d.input_type ?? null,
        required: d.required ?? null,
        maxlength: d.maxlength ?? null,
        pattern: d.pattern ?? null,
        readonly: d.readonly ?? null,
        disabled: false, // 仅满足类型；disabled 由 denoise 计入 state，运行期无人读此字段
      };
      // 元素内部/自身包含 <input type=file>（如 antd Upload 的隐藏输入）→ 走 file_upload 分类
      if (d.has_file_input && !out.constraints.input_type) out.constraints.input_type = 'file';
      out.hints.placeholder = d.placeholder ?? null;
      out.hints.css_selector = d.tag ? String(d.tag).toLowerCase() : null;
      out.visible = d.rect_visible !== false;
      out.bounds = { width: d.width, height: d.height };
    }
  } catch { /* 补属性失败不阻塞：诚实降级为无约束 */ }
  out.backendDOMNodeId = candidate.backendDOMNodeId ?? `alt-${++enrichSeq}`;
  return out;
}
