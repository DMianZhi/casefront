export type IconName = 'idle' | 'load' | 'ok' | 'err' | 'warn';

// 与旧 popup.js 第 27-33 行逐字相同的 5 段 svg 字符串
const ICONS: Record<IconName, string> = {
  idle: '<svg viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.6"/><path d="M12 11.3v4.9"/><circle cx="12" cy="7.9" r="1.1" fill="var(--text-3)" stroke="none"/></svg>',
  load: '<svg viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2.2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-9-9"/></svg>',
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.6"/><path d="m8.4 12.4 2.4 2.4 4.8-5.2"/></svg>',
  err: '<svg viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="8.6"/><path d="M12 8v5M12 15.8v.2"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.2 2.8 20h18.4L12 4.2z"/><path d="M12 10.2v4M12 17v.2"/></svg>',
};

export default function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  const svg = ICONS[name];
  const spinning = name === 'load';
  return (
    <span
      className={`inline-block size-4 ${className}`}
      dangerouslySetInnerHTML={{ __html: spinning ? svg.replace('<svg ', '<svg class="animate-spin-slow" ') : svg }}
    />
  );
}
