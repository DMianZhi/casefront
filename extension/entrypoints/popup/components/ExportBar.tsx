import { useRef, useState } from 'react';
import { copyText } from '@/lib/clipboard';

// 导出成功后的路径行：出现在 scan 视图 StatusPanel 下方（与旧 popup.html:244-253 保持同一 DOM 顺序）
export function PathRow({ path }: { path: string }) {
  const [copied, setCopied] = useState<'none' | 'ok' | 'fail'>('none');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  async function copy() {
    const ok = await copyText(path);
    setCopied(ok ? 'ok' : 'fail');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied('none'), 1500);
  }

  return (
    <div className="mt-[9px] flex items-center gap-2 rounded-[9px] border-[0.5px] border-sep bg-card py-[7px] pr-2 pl-[10px]">
      <span className="min-w-0 flex-1 break-all font-mono text-[10.5px] leading-[1.45] text-text-2">{path}</span>
      <button
        onClick={copy}
        className={`inline-flex h-[26px] flex-none items-center gap-1.5 rounded-[7px] px-2.5 text-xs font-medium transition-colors ${
          copied === 'ok' ? 'bg-green-bg text-green' : copied === 'fail' ? 'bg-fill text-red' : 'bg-fill text-blue hover:bg-fill-hover'
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-[13px] flex-none">
          <rect x="9" y="9" width="11" height="11" rx="2.5" />
          <path d="M5.5 14.5H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 2 2v.5" />
        </svg>
        {copied === 'ok' ? '已复制' : copied === 'fail' ? '复制失败' : '复制路径'}
      </button>
    </div>
  );
}

export default function ExportBar({ onExport, exporting, exportPath }: {
  onExport: () => Promise<void>;
  exporting: boolean;
  exportPath: string | null;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onExport}
        disabled={exporting}
        className="inline-flex h-[34px] flex-none items-center justify-center gap-1.5 rounded-[10px] bg-blue px-3.5 font-semibold text-white transition-all hover:bg-blue-hover active:bg-blue-press active:scale-[0.97] disabled:scale-none disabled:opacity-40"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-[15px] flex-none">
          <path d="M12 3.5v11M12 14.5 7.5 10M12 14.5 16.5 10" />
          <path d="M4 16.5v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        {exporting ? '导出中…' : '保存并导出'}
      </button>
      {exportPath ? <PathRow path={exportPath} /> : null}
    </div>
  );
}
