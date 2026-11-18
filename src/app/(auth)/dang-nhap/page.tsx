import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Alert } from '@/components/ui';
import { getMe } from '@/server/auth';
import { SignInForm } from '@/features/auth/forms';

export const metadata: Metadata = { title: 'Đăng nhập' };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; locked?: string }> }) {
  const { next = '', locked } = await searchParams;
  const me = await getMe();
  if (me && !me.is_locked) redirect(next || (me.role === 'teacher' ? '/gv' : '/'));
  return (
    <>
      <h1 className="text-xl font-bold">Đăng nhập</h1>
      <p className="mb-5 mt-1 text-sm text-muted">{next ? 'Đăng nhập để vào làm bài.' : 'Chào bạn, đăng nhập để tiếp tục.'}</p>
      {locked && <Alert className="mb-4">Tài khoản đang bị khoá. Hãy báo giáo viên.</Alert>}
      <SignInForm next={next} />
    </>
  );
}
