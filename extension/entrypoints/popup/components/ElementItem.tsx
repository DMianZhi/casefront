import type { InventoryElement } from '@/lib/inventory';

export default function ElementItem({ el, checked, onToggle }: {
  el: InventoryElement; checked: boolean; onToggle: (id: string, checked: boolean) => void;
}) {
  const n = Number(el.group?.member_count) || 0;
  return (
    <li className="flex items-center gap-2.5 px-3 py-[9px] hover:bg-fill [&+&]:border-t [&+&]:border-sep">
      <input
        type="checkbox"
        className="custom-cb"
        checked={checked}
        data-id={el.id}
        aria-label={el.label}
        onChange={e => onToggle(el.id, e.target.checked)}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] break-all">{el.label || el.hints?.placeholder || '(未命名)'}</div>
        <div className="mt-[3px] flex flex-wrap gap-[5px]">
          {el.interaction_type ? (
            <span className="rounded-[5px] bg-fill px-1.5 py-[3px] text-[10.5px] leading-none text-text-2">{el.interaction_type}</span>
          ) : null}
          {el.group ? (
            <span
              title={`同类折叠组：${el.group.signature}`}
              className="inline-flex items-center gap-0.5 rounded-[5px] bg-green-bg py-[3px] pr-1.5 pl-[6px] text-[10.5px] leading-none text-green"
            >
              {/* 乘号仅为配角：约数字 x 高度八成 + 降不透明度，数字是主角 */}
              <svg viewBox="0 0 10 10" aria-hidden="true" className="block size-[5.5px] opacity-80">
                <path d="M2.2 2.2l5.6 5.6M7.8 2.2l-5.6 5.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
              </svg>
              <b className="text-[9.5px] font-semibold tracking-[0.1px]">{n}</b>
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}
