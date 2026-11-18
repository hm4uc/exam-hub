import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { RegisterForm } from '../auth-forms';

export const metadata: Metadata = { title: 'Đăng ký' };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = '' } = await searchParams;
  if (await getMe()) redirect(next || '/');
  return (
    <>
      <h1 className="text-xl font-bold">Tạo tài khoản học sinh</h1>
      <p className="mb-5 mt-1 text-sm text-muted">Chỉ cần làm một lần. Lần sau máy sẽ tự nhớ đăng nhập.</p>
      <RegisterForm next={next} />
    </>
  );
}
