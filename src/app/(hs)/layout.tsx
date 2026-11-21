import { StudentShell } from '@/components/shell/student-shell';
import { getMe } from '@/server/auth';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  const user = me && !me.is_locked
    ? { full_name: me.full_name, role: me.role, class_name: me.class_name, must_change_password: me.must_change_password }
    : null;
  return <StudentShell user={user}>{children}</StudentShell>;
}
