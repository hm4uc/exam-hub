import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ExamPreviewClient, type PreviewQuestion } from '@/features/exams/exam-preview';
import { supabaseServer } from '@/server/supabase/server';

export const metadata: Metadata = { title: 'Xem trước đề thi' };

export default async function ExamPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await supabaseServer();
  const [{ data: exam }, { data: qs }] = await Promise.all([
    supabase.from('exams').select('id, title').eq('id', id).maybeSingle(),
    supabase.from('questions').select('id, position, part, type, stem_html, choices, answer, solution_html').eq('exam_id', id).order('position'),
  ]);
  if (!exam) notFound();
  return <ExamPreviewClient examId={exam.id} title={exam.title} questions={(qs ?? []) as PreviewQuestion[]} />;
}
