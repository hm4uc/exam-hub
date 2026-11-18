import Link from 'next/link';
import { KeyRound, LogOut } from 'lucide-react';
import { ThemeSwitch } from '@/components/theme-switch';
import { signOut } from '@/features/auth/actions';

/** Menu tài khoản trên thanh navy. Dùng <details> để chạy được cả khi JS chưa tải. */
export function UserMenu({ name, sub }: { name: string; sub?: string }) {
  const initial = name.trim().split(/\s+/).pop()?.[0]?.toUpperCase();
  return (
    <details className="group relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-1.5 text-sm hover:bg-white/10 [&::-webkit-details-marker]:hidden" aria-label={`Tài khoản: ${name}`}>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-sm font-bold">{initial}</span>
        <span className="hidden min-w-0 text-left lg:block">
          <span className="block max-w-[12rem] truncate font-semibold leading-tight">{name}</span>
          {sub && <span className="block text-xs text-shell-muted">{sub}</span>}
        </span>
      </summary>
      <div className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-xl border border-line bg-surface text-sm text-ink shadow-pop">
        <div className="border-b border-line px-4 py-3">
          <p className="truncate font-semibold">{name}</p>
          {sub && <p className="text-xs text-muted">{sub}</p>}
        </div>
        <div className="border-b border-line px-4 py-3 sm:hidden">
          <p className="mb-2 text-xs font-medium text-muted">Giao diện</p>
          <ThemeSwitch showLabels className="w-full [&>button]:flex-1" />
        </div>
        <div className="py-1">
          <Link href="/doi-mat-khau" className="flex min-h-11 items-center gap-2.5 px-4 hover:bg-sunken"><KeyRound className="h-4 w-4 text-muted" aria-hidden />Đổi mật khẩu</Link>
          <form action={signOut}>
            <button className="flex min-h-11 w-full items-center gap-2.5 px-4 text-left text-pen hover:bg-pen-soft"><LogOut className="h-4 w-4" aria-hidden />Đăng xuất</button>
          </form>
        </div>
      </div>
    </details>
  );
}
