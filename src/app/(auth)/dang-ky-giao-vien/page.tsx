import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { RegisterTeacherForm } from '@/features/invites/register-teacher-form';
import { getMe, homePathFor } from '@/server/auth';

export const metadata: Metadata = { title: 'Đăng ký giáo viên' };

export default async function RegisterTeacherPage({ searchParams }: { searchParams: Promise<{ ma?: string }> }) {
  const { ma = '' } = await searchParams;
  const me = await getMe();
  if (me) redirect(homePathFor(me.role));
  return (
    <>
      <h1 className="mb-1 text-xl font-bold">Đăng ký giáo viên</h1>
      <p className="mb-5 text-sm text-muted">Cần mã mời do quản trị viên cấp.</p>
      <RegisterTeacherForm invite={ma.toLowerCase().slice(0, 10)} />
    </>
  );
}
