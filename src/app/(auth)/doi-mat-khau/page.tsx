import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Alert } from '@/components/ui';
import { getMe } from '@/server/auth';
import { ChangePasswordForm } from '@/features/auth/forms';

export const metadata: Metadata = { title: 'Đổi mật khẩu' };

export default async function ChangePasswordPage() {
  const me = await getMe();
  if (!me) redirect('/dang-nhap');
  return (
    <>
      <h1 className="text-xl font-bold">Đổi mật khẩu</h1>
      <p className="mb-5 mt-1 text-sm text-muted">Tài khoản: <b className="text-ink">{me.username}</b></p>
      {me.must_change_password && <Alert tone="warn" className="mb-4">Giáo viên vừa đặt lại mật khẩu cho bạn. Hãy đặt mật khẩu mới để tiếp tục.</Alert>}
      <ChangePasswordForm />
    </>
  );
}
