import Link from 'next/link';
import { signOut } from '@/app/(auth)/actions';

export function UserMenu({ name, sub, tone = 'light' }: { name: string; sub?: string; tone?: 'light' | 'brand' }) {
  const muted = tone === 'brand' ? 'text-brand-on/75' : 'text-muted';
  return (
    <details className="group relative">
      <summary className={`flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${tone === 'brand' ? 'hover:bg-white/10' : 'hover:bg-sunken'}`}>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand">{name.trim().split(/\s+/).pop()?.[0]?.toUpperCase()}</span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-[12rem] truncate font-semibold">{name}</span>
          {sub && <span className={`block text-xs ${muted}`}>{sub}</span>}
        </span>
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-xl border border-line bg-surface py-1 text-sm text-ink shadow-pop">
        <p className="border-b border-line px-3 py-2 sm:hidden"><b>{name}</b>{sub && <span className="block text-xs text-muted">{sub}</span>}</p>
        <Link href="/doi-mat-khau" className="block px-3 py-2 hover:bg-sunken">Đổi mật khẩu</Link>
        <form action={signOut}><button className="block w-full px-3 py-2 text-left text-pen hover:bg-pen-soft">Đăng xuất</button></form>
      </div>
    </details>
  );
}
