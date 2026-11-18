import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getMe } from '@/server/auth';
import { RegisterForm } from '@/features/auth/forms';

export const metadata: Metadata = { title: 'Đăng ký' };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = '' } = await searchParams;
  if (await getMe()) redirect(next || '/');
  return (
    <>
      <h1 className="mb-5 text-xl font-bold">Đăng ký</h1>
      <RegisterForm next={next} />
    </>
  );
}
