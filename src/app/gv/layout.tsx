import Link from 'next/link';
import { AppHeader } from '@/components/shell/app-header';
import { TeacherNav } from '@/components/shell/teacher-nav';
import { FileDropOverlay } from '@/features/exams/file-drop-overlay';
import { requireTeacher } from '@/server/auth';

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const me = await requireTeacher();
  const isAdmin = me.role === 'admin';
  return (
    <>
      <AppHeader
        home={isAdmin ? '/admin' : '/gv'}
        width="max-w-6xl"
        user={{ name: me.full_name, sub: isAdmin ? 'Quản trị hệ thống' : 'Giáo viên' }}
        nav={<TeacherNav isAdmin={isAdmin} />}
      />
      {me.must_change_password && (
        <div className="border-b border-warn/25 bg-warn-soft text-sm text-warn">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
            <span>Bạn đang dùng mật khẩu tạm. <Link href="/doi-mat-khau" className="font-semibold underline">Đổi mật khẩu ngay</Link></span>
          </div>
        </div>
      )}
      <FileDropOverlay />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>{children}</main>
    </>
  );
}
