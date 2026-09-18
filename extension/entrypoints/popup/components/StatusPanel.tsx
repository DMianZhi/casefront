import Icon, { type IconName } from './Icon';

export type StatusKind = IconName;

export default function StatusPanel({ kind, text, sub }: { kind: StatusKind; text: string; sub: string }) {
  return (
    <div className="mt-3 rounded-[11px] bg-fill px-3 py-2.5">
      <div className="flex items-start gap-2">
        <span className="mt-[1.5px]"><Icon name={kind} /></span>
        <div className="min-w-0 flex-1 text-[12.5px] font-medium">
          {text}
          {sub ? <span className="mt-[3px] block text-xs font-normal text-text-2">{sub}</span> : null}
        </div>
      </div>
      {/* 路径行由 App 在 StatusPanel 之后渲染（保持旧 DOM 顺序） */}
    </div>
  );
}
