import { InAppHint } from '@/components/inapp-hint';
import { AppHeader } from '@/components/shell/app-header';
import { requireStudent } from '@/server/auth';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const me = await requireStudent();
  return (
    <>
      <AppHeader home="/" width="max-w-3xl" user={{ name: me.full_name, sub: me.class_name ? `Lớp ${me.class_name}` : 'Chưa xếp lớp' }} />
      <InAppHint />
      {children}
    </>
  );
}
