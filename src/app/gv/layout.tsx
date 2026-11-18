import { AppHeader } from '@/components/shell/app-header';
import { TeacherNav } from '@/components/shell/teacher-nav';
import { FileDropOverlay } from '@/features/exams/file-drop-overlay';
import { requireTeacher } from '@/server/auth';

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const me = await requireTeacher();
  return (
    <>
      <AppHeader home="/gv" width="max-w-6xl" user={{ name: me.full_name, sub: 'Giáo viên' }} nav={<TeacherNav />} />
      <FileDropOverlay />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>{children}</main>
    </>
  );
}
