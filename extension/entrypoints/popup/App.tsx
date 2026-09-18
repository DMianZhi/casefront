import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { Inventory } from '@/lib/inventory';
import { applySelections } from '@/lib/selection';
import { saveScan } from '@/lib/storage';
import type { DownloadExportResponse, GetLastScanResponse, PopupRequest, ScanResponse } from '@/lib/messages';
import StatusPanel, { type StatusKind } from './components/StatusPanel';
import ElementList from './components/ElementList';
import ExportBar, { PathRow } from './components/ExportBar';

type View = 'scan' | 'review';

interface State {
  view: View;
  status: { kind: StatusKind; text: string; sub: string };
  session: Inventory | null;
  pending: Record<string, boolean>;
  exportPath: string | null;
  exporting: boolean;
}

type Action =
  | { type: 'RESET_STATUS' }
  | { type: 'STATUS'; kind: StatusKind; text: string; sub?: string }
  | { type: 'SESSION'; session: Inventory }
  | { type: 'TOGGLE'; id: string; checked: boolean }
  | { type: 'SET_ALL'; checked: boolean }
  | { type: 'EXPORT_PATH'; path: string | null }
  | { type: 'EXPORTING'; exporting: boolean }
  | { type: 'VIEW'; view: View };

const initialState: State = {
  view: 'scan',
  status: { kind: 'idle', text: '就绪', sub: '扫描当前页面，生成可勾选的交互元素清单' },
  session: null,
  pending: {},
  exportPath: null,
  exporting: false,
};

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'RESET_STATUS': return { ...s, status: initialState.status };
    case 'STATUS': return { ...s, status: { kind: a.kind, text: a.text, sub: a.sub ?? '' } };
    case 'SESSION': return { ...s, session: a.session, pending: {} };
    case 'TOGGLE': return { ...s, pending: { ...s.pending, [a.id]: a.checked } };
    case 'SET_ALL': {
      const pending: Record<string, boolean> = {};
      for (const el of s.session?.elements ?? []) pending[el.id] = a.checked;
      return { ...s, pending };
    }
    case 'EXPORT_PATH': return { ...s, exportPath: a.path };
    case 'EXPORTING': return { ...s, exporting: a.exporting };
    case 'VIEW': return { ...s, view: a.view };
  }
}

function send<T>(req: PopupRequest): Promise<T> {
  return chrome.runtime.sendMessage(req) as Promise<T>;
}

// 模式选择器下拉箭头（迁移自旧 popup.html:112 的背景图 data URI）
const SELECT_ARROW =
  'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\' viewBox=\'0 0 10 6\'%3E%3Cpath d=\'M1 1l4 4 4-4\' stroke=\'%236e6e73\' stroke-width=\'1.6\' fill=\'none\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E")';

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const modeRef = useRef<HTMLSelectElement>(null);

  const isChecked = useCallback(
    (id: string) => state.pending[id] ?? (state.session?.elements.find(e => e.id === id)?.selected !== false),
    [state.pending, state.session],
  );
  const selectedCount = (state.session?.elements ?? []).filter(el => isChecked(el.id)).length;

  // popup 每次打开重置到 scan 视图（与旧版一致：无恢复逻辑）
  useEffect(() => { dispatch({ type: 'RESET_STATUS' }); }, []);

  async function scan(mode: 'compact' | 'full') {
    dispatch({ type: 'STATUS', kind: 'load', text: '采集中…', sub: mode === 'compact' ? '精简模式：同类元素折叠为一组代表' : '完整模式：全量清单，不折叠' });
    let res: ScanResponse;
    try { res = await send<ScanResponse>({ type: 'SCAN', mode }); }
    catch (e) { dispatch({ type: 'STATUS', kind: 'err', text: '扫描失败：' + (e as Error).message }); return; }
    if (!res.ok) {
      dispatch({ type: 'STATUS', kind: 'err', text: res.error, sub: 'DevTools 开着会占用调试通道，关闭后重试' });
      return;
    }
    dispatch({ type: 'STATUS', kind: 'ok', text: `已采集 ${res.count} 个交互元素`, sub: res.folded_groups > 0 ? `同类折叠：${res.folded_groups} 组，进入勾选确认` : '进入勾选确认' });
    const snap = await send<GetLastScanResponse>({ type: 'GET_LAST_SCAN' });
    if (snap?.ok && snap.inventory) {
      dispatch({ type: 'SESSION', session: snap.inventory });
      dispatch({ type: 'VIEW', view: 'review' });
    }
  }

  async function exportInventory() {
    if (!state.session || state.exporting) return;
    dispatch({ type: 'EXPORTING', exporting: true });
    dispatch({ type: 'EXPORT_PATH', path: null });
    try {
      const sessionId = state.session.meta?.session_id ?? state.session.session_id;
      const elements = applySelections(state.session.elements, state.pending);
      const inventory: Inventory = { ...state.session, elements, session_id: sessionId };
      inventory.meta = { ...state.session.meta, session_id: sessionId, exported_at: new Date().toISOString() };
      try { await saveScan(inventory); } catch { /* 快照持久化失败不阻塞导出 */ }
      const res = await send<DownloadExportResponse>({ type: 'DOWNLOAD_EXPORT', inventory });
      if (!res?.ok) { dispatch({ type: 'STATUS', kind: 'err', text: '导出失败：' + (res?.error ?? '未知错误') }); return; }
      if (res.absolute_path) {
        dispatch({ type: 'EXPORT_PATH', path: res.absolute_path });
        dispatch({ type: 'STATUS', kind: 'ok', text: '已导出（selected 已写回清单）', sub: '在 Comate 中 @ 该文件生成用例' });
      } else {
        dispatch({ type: 'STATUS', kind: 'warn', text: '已导出（未解析到落盘绝对路径）', sub: res.path });
      }
      dispatch({ type: 'VIEW', view: 'scan' });
    } finally {
      dispatch({ type: 'EXPORTING', exporting: false });
    }
  }

  if (state.view === 'review') {
    return (
      <div className="animate-view">
        <div className="mb-3 flex items-center gap-2">
          <button onClick={() => { dispatch({ type: 'RESET_STATUS' }); dispatch({ type: 'VIEW', view: 'scan' }); }}
                  className="inline-flex h-7 flex-none items-center gap-1 rounded-lg bg-fill px-[11px] text-xs text-blue hover:bg-fill-hover">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-[13px]"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>
            重扫
          </button>
          <h3 className="m-0 flex-1 text-[15px] font-semibold tracking-[-0.2px]">勾选纳入用例生成的元素</h3>
        </div>
        <div className="mb-2.5 flex items-center gap-2">
          <button onClick={() => dispatch({ type: 'SET_ALL', checked: true })}
                  className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-lg bg-fill px-2.5 text-xs font-medium text-blue hover:bg-fill-hover active:bg-fill-press">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-[13px]"><path d="m4.5 12.5 5 5 10-11"/></svg>
            全选
          </button>
          <button onClick={() => dispatch({ type: 'SET_ALL', checked: false })}
                  className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-lg bg-fill px-2.5 text-xs font-medium text-blue hover:bg-fill-hover active:bg-fill-press">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-[13px]"><path d="M6 12h12"/></svg>
            全不选
          </button>
          {/* review 视图 ExportBar 只作导出按钮，不显示路径行 */}
          <ExportBar onExport={exportInventory} exporting={state.exporting} exportPath={null} />
        </div>
        <div className="mx-0.5 mb-2 text-xs text-text-2">
          已选 <b className="font-semibold text-text">{selectedCount}</b> / {(state.session?.elements ?? []).length}
        </div>
        <ElementList elements={state.session?.elements ?? []} isPending={isChecked}
                     onToggle={(id, checked) => dispatch({ type: 'TOGGLE', id, checked })} />
      </div>
    );
  }

  return (
    <div className="animate-view">
      {/* 卡片：logo + 标题 + 模式选择 + 扫描按钮 + 状态区 */}
      <div className="mb-2.5 rounded-[14px] border-[0.5px] border-sep bg-card p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        {/* 头部：logo SVG 逐字迁移自旧 popup.html:216-219 */}
        <div className="flex items-center gap-[11px]">
          <div className="grid size-[38px] flex-none place-items-center rounded-[9.5px] bg-[linear-gradient(180deg,#37a2ff,#007aff)] shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.25),0_1px_2px_rgba(0,122,255,0.35)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" className="size-[22px]">
              <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/>
              <circle cx="12" cy="12" r="2.4" fill="#fff" stroke="none"/>
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="m-0 text-[15px] font-semibold tracking-[-0.2px]">CaseFront</h3>
            <div className="mt-px text-[11.5px] text-text-2">Web 测试用例 AI 前置助手</div>
          </div>
        </div>
        <div className="mt-[13px] flex items-center gap-2">
          <select
            ref={modeRef}
            defaultValue="compact"
            className="h-[34px] flex-1 cursor-pointer appearance-none rounded-[10px] border-none bg-fill pl-3 pr-[28px] font-[inherit] text-text transition-colors hover:bg-fill-hover"
            style={{ backgroundImage: SELECT_ARROW, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 11px center' }}
          >
            <option value="compact">精简（同类折叠）</option>
            <option value="full">完整（全量）</option>
          </select>
          <button
            onClick={() => scan(modeRef.current?.value === 'full' ? 'full' : 'compact')}
            className="inline-flex h-[34px] flex-none items-center gap-1.5 rounded-[10px] bg-blue px-3.5 font-semibold text-white transition-all hover:bg-blue-hover active:bg-blue-press active:scale-[0.97]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-[15px] flex-none"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M8.5 12h7"/></svg>
            扫描此页
          </button>
        </div>
        <StatusPanel kind={state.status.kind} text={state.status.text} sub={state.status.sub} />
        {/* 导出成功后的路径行：渲染在状态区内（保持旧 DOM 顺序） */}
        {state.exportPath ? <PathRow path={state.exportPath} /> : null}
      </div>
      <div className="mt-2.5 text-[11.5px] leading-[1.55] text-text-3">
        <span className="font-medium text-text-2">精简模式</span>：5 个以上同类元素折叠为一组；<span className="font-medium text-text-2">完整模式</span>全量导出。<br />
        扫描后进入勾选视图，可按需收缩用例范围。
      </div>
    </div>
  );
}
