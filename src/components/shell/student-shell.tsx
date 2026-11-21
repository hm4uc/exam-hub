'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LogIn, X } from 'lucide-react';
import { InAppHint } from '@/components/inapp-hint';
import { AppHeader } from '@/components/shell/app-header';
import { LogoMark } from '@/components/shell/logo';
import { ThemeSwitch } from '@/components/theme-switch';

const IN_EXAM = /^\/[a-z2-9]{6}\/lam(?:\/|$)/i;

interface ShellUser {
  full_name: string;
  role: 'admin' | 'teacher' | 'student';
  class_name: string | null;
  must_change_password: boolean;
}

export function StudentShell({ user, children }: { user: ShellUser | null; children: React.ReactNode }) {
  const path = usePathname() ?? '';
  const inExam = IN_EXAM.test(path);
  const [hidePwHint, setHidePwHint] = useState(false);

  const sub = user
    ? user.role === 'admin'
      ? 'Quản trị hệ thống'
      : user.role === 'teacher'
        ? 'Giáo viên'
        : user.class_name
          ? `Lớp ${user.class_name}`
          : 'Chưa xếp lớp'
    : '';
  const home = user?.role === 'admin' ? '/admin' : user?.role === 'teacher' ? '/gv' : '/';

  return (
    <>
      {!inExam && (
        user ? (
          <AppHeader home={home} width="max-w-3xl" user={{ name: user.full_name, sub }} />
        ) : (
          <header className="bg-shell text-shell-ink shadow-[inset_0_-1px_0_rgb(255_255_255/0.08)]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="mx-auto flex max-w-3xl items-center gap-x-4 px-4" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
              <Link href="/dang-nhap" className="flex min-h-14 items-center gap-2 font-bold tracking-tight">
                <LogoMark className="h-6 w-6" />Exam Hub
              </Link>
              <div className="ml-auto flex items-center gap-2">
                <ThemeSwitch onShell className="hidden sm:inline-flex" />
                <Link
                  href={`/dang-nhap${path && path !== '/' ? `?next=${encodeURIComponent(path)}` : ''}`}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm font-medium text-shell-ink hover:bg-white/20"
                >
                  <LogIn className="h-4 w-4" aria-hidden />Đăng nhập
                </Link>
              </div>
            </div>
          </header>
        )
      )}

      {!inExam && user?.must_change_password && !hidePwHint && (
        <div className="border-b border-warn/25 bg-warn-soft text-sm text-warn">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2">
            <p className="min-w-0 flex-1">
              Bạn đang dùng mật khẩu tạm giáo viên đặt lại.{' '}
              <Link href="/doi-mat-khau" className="font-semibold underline">Đổi mật khẩu</Link>
            </p>
            <button type="button" onClick={() => setHidePwHint(true)} aria-label="Đóng nhắc nhở" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-warn/10">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}

      {!inExam && <InAppHint />}
      {children}
    </>
  );
}
