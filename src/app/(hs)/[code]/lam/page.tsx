import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isCode } from '@/lib/format';
import { ExamRunner } from './exam-runner';

export const metadata: Metadata = { title: 'Làm bài' };

export default async function TakePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!isCode(code)) notFound();
  return <ExamRunner code={code} />;
}
