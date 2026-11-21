import Link from 'next/link';
import { RouteStage } from '@/components/route-stage';
import { ThemeSwitch } from '@/components/theme-switch';
import { LogoMark } from '@/components/shell/logo';

// Trang đăng nhập/đăng ký/đổi mật khẩu: dải navy phía trên, thẻ biểu mẫu nằm đè lên mép dải.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <div className="h-44 bg-shell sm:h-56" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex max-w-md items-center justify-between px-4 pt-4 text-shell-ink">
          <Link href="/" className="flex min-h-10 items-center gap-2 text-lg font-bold tracking-tight hover:opacity-90">
            <LogoMark />Exam Hub
          </Link>
          <ThemeSwitch onShell />
        </div>
      </div>
      <main id="main-content" className="mx-auto -mt-24 max-w-md px-4 pb-10 sm:-mt-32">
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-pop sm:p-8">
          <RouteStage>{children}</RouteStage>
        </div>
      </main>
    </div>
  );
}
