import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Alert } from '@/components/ui';
import { getMe, homePathFor } from '@/server/auth';
import { JoinByCodeForm, SignInForm } from '@/features/auth/forms';

export const metadata: Metadata = { title: 'Đăng nhập' };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; locked?: string }> }) {
  const { next = '', locked } = await searchParams;
  const me = await getMe();
  if (me && !me.is_locked) redirect(next || homePathFor(me.role));
  return (
    <>
      <h1 className="text-xl font-bold">Đăng nhập</h1>
      <p className="mb-5 mt-1 text-sm text-muted">{next ? 'Đăng nhập để tiếp tục.' : 'Đăng nhập nếu bạn có tài khoản giáo viên hoặc học sinh.'}</p>
      {locked && <Alert className="mb-4">Tài khoản đang bị khoá. Hãy báo giáo viên.</Alert>}
      <SignInForm next={next} />
      <JoinByCodeForm />
    </>
  );
}
