import Link from 'next/link';
import { UserMenu } from '@/components/user-menu';
import { requireTeacher } from '@/lib/auth';
import { GvNav } from './nav';

// Khung giáo viên: thanh trên màu mực xanh (shell), nội dung trên nền giấy.
export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const me = await requireTeacher();
  return (
    <>
      <header className="bg-brand text-brand-on" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
          <Link href="/gv" className="py-1 font-bold tracking-tight">Exam Hub</Link>
          <GvNav />
          <div className="ml-auto"><UserMenu name={me.full_name} sub="Giáo viên" tone="brand" /></div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>{children}</main>
    </>
  );
}
