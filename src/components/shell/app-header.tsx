import Link from 'next/link';
import type { ReactNode } from 'react';
import { ThemeSwitch } from '@/components/theme-switch';
import { LogoMark } from './logo';
import { UserMenu } from './user-menu';

/** Thanh trên dùng chung (giáo viên và học sinh): nền navy, logo, điều hướng, giao diện, tài khoản.
 *  Trên điện thoại, điều hướng xuống hàng thứ hai và cuộn ngang. */
export function AppHeader({ home, width, user, nav }: { home: string; width: string; user: { name: string; sub: string }; nav?: ReactNode }) {
  return (
    <header className="bg-shell text-shell-ink shadow-[inset_0_-1px_0_rgb(255_255_255/0.08)]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className={`mx-auto flex flex-wrap items-center gap-x-4 px-4 ${width}`} style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
        <Link href={home} className="flex min-h-14 items-center gap-2 font-bold tracking-tight">
          <LogoMark className="h-6 w-6" />Exam Hub
        </Link>
        {nav && <div className="order-last -mx-4 w-[calc(100%+2rem)] border-t border-white/10 px-2 md:order-none md:mx-0 md:w-auto md:border-0 md:px-0">{nav}</div>}
        <div className="ml-auto flex items-center gap-2">
          <ThemeSwitch onShell className="hidden sm:inline-flex" />
          <UserMenu name={user.name} sub={user.sub} />
        </div>
      </div>
    </header>
  );
}
