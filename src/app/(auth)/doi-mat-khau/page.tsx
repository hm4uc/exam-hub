import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Alert } from '@/components/ui';
import { getMe, homePathFor } from '@/server/auth';
import { ChangePasswordForm } from '@/features/auth/forms';

export const metadata: Metadata = { title: 'Đổi mật khẩu' };

export default async function ChangePasswordPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = '' } = await searchParams;
  const me = await getMe();
  if (!me) redirect('/dang-nhap');
  const home = homePathFor(me.role);
  return (
    <>
      <h1 className="text-xl font-bold">Đổi mật khẩu</h1>
      <p className="mb-5 mt-1 text-sm text-muted">Tài khoản: <b className="text-ink">{me.username}</b></p>
      {me.must_change_password && (
        <Alert tone="warn" className="mb-4">
          Giáo viên vừa đặt lại mật khẩu cho bạn. Bạn nên đặt mật khẩu mới dễ nhớ — hoặc bấm “Để sau” bên dưới để vào luôn.
        </Alert>
      )}
      <ChangePasswordForm next={next} mustChange={me.must_change_password} homeHref={home} />
    </>
  );
}
