import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isCode } from '@/lib/format';
import { ExamRunner } from '@/features/attempt/exam-runner';

export const metadata: Metadata = { title: 'Làm bài' };

export default async function TakePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalized = code.toLowerCase();
  if (!isCode(normalized)) notFound();
  return <ExamRunner code={normalized} />;
}
