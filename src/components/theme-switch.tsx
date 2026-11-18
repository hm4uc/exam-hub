'use client';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { cx } from '@/components/ui';
import { THEME_COLOR, THEME_KEY, type ThemePref } from './theme';

const EVENT = 'eh:theme';
const read = (): ThemePref => {
  try { const t = localStorage.getItem(THEME_KEY); return t === 'light' || t === 'dark' ? t : 'system'; } catch { return 'system'; }
};
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener('storage', cb); };
};

function apply(pref: ThemePref) {
  try { if (pref === 'system') localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, pref); } catch { /* chế độ riêng tư */ }
  const html = document.documentElement;
  if (pref === 'system') html.removeAttribute('data-theme'); else html.setAttribute('data-theme', pref);
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name=theme-color]').forEach((m) => {
    if (pref === 'system') m.setAttribute('content', m.getAttribute('media')?.includes('dark') ? THEME_COLOR.dark : THEME_COLOR.light);
    else m.setAttribute('content', dark ? THEME_COLOR.dark : THEME_COLOR.light);
  });
  window.dispatchEvent(new Event(EVENT));
}

const OPTIONS = [
  { v: 'light', label: 'Sáng', Icon: Sun },
  { v: 'dark', label: 'Tối', Icon: Moon },
  { v: 'system', label: 'Theo máy', Icon: Monitor },
] as const;

/** Chọn giao diện Sáng / Tối / Theo máy. `onShell`: đặt trên thanh navy. */
export function ThemeSwitch({ onShell = false, showLabels = false, className }: { onShell?: boolean; showLabels?: boolean; className?: string }) {
  const pref = useSyncExternalStore(subscribe, read, () => 'system' as ThemePref);
  return (
    <div role="radiogroup" aria-label="Giao diện" className={cx('inline-flex rounded-lg p-0.5', onShell ? 'bg-white/10' : 'bg-sunken', className)}>
      {OPTIONS.map(({ v, label, Icon }) => {
        const on = pref === v;
        return (
          <button key={v} type="button" role="radio" aria-checked={on} aria-label={label} title={label} onClick={() => apply(v)}
            className={cx('inline-flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors',
              onShell
                ? on ? 'bg-white/20 text-shell-ink' : 'text-shell-muted hover:text-shell-ink'
                : on ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}>
            <Icon className="h-4 w-4" aria-hidden />
            {showLabels && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
