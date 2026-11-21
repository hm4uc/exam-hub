import Link from 'next/link';
import { AppHeader } from '@/components/shell/app-header';
import { requireAdmin } from '@/server/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin();
  const nav = (
    <nav aria-label="Quản trị" className="flex overflow-x-auto [scrollbar-width:none]">
      <Link href="/admin" aria-current="page" className="relative inline-flex min-h-12 items-center whitespace-nowrap px-3 text-sm font-medium text-shell-ink md:min-h-14">
        Nhật ký &amp; sự cố
        <span aria-hidden className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-shell-ink" />
      </Link>
      <Link href="/gv" className="relative inline-flex min-h-12 items-center whitespace-nowrap px-3 text-sm font-medium text-shell-muted hover:text-shell-ink md:min-h-14">
        Trang giáo viên
      </Link>
    </nav>
  );

  return (
    <>
      <AppHeader home="/admin" width="max-w-6xl" user={{ name: me.full_name, sub: 'Quản trị hệ thống' }} nav={nav} />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
        {children}
      </main>
    </>
  );
}
