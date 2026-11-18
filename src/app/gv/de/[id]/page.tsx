import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Send } from 'lucide-react';
import { Badge, ButtonLink, PageTitle } from '@/components/ui';
import { DEFAULT_SCORING, type Scoring } from '@/domain/exam/types';
import { supabaseServer } from '@/server/supabase/server';
import { ExamMeta, QuestionList } from '@/features/exams/editor';
import type { QRow } from '@/features/exams/types';

export const metadata: Metadata = { title: 'Sửa đề' };

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await supabaseServer();
  const [{ data: exam }, { data: qs }, { data: asg }] = await Promise.all([
    supabase.from('exams').select('id, title, status, scoring').eq('id', id).maybeSingle(),
    supabase.from('questions').select('id, position, part, type, stem, stem_html, choices, answer, solution, points').eq('exam_id', id).order('position'),
    supabase.from('assignments').select('id, title, code, classes(name)').eq('exam_id', id).order('created_at', { ascending: false }),
  ]);
  if (!exam) notFound();
  const scoring: Scoring = { ...DEFAULT_SCORING, ...(exam.scoring as Partial<Scoring>) };

  return (
    <>
      <PageTitle title={exam.title} back={{ href: '/gv/de', label: 'Đề thi' }}>
        {exam.status === 'published' ? <Badge tone="ok" className="self-center">Đã xuất bản</Badge> : <Badge tone="warn" className="self-center">Nháp</Badge>}
        <ButtonLink href={`/gv/de/${id}/giao`}><Send className="h-4 w-4" aria-hidden />Giao bài</ButtonLink>
      </PageTitle>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <QuestionList questions={(qs ?? []) as QRow[]} scoring={scoring} locked={!!asg?.length} />
        <aside className="grid gap-4 lg:sticky lg:top-4">
          <ExamMeta id={id} title={exam.title} scoring={scoring} status={exam.status as 'draft' | 'published'} count={qs?.length ?? 0} />
          {!!asg?.length && (
            <section className="rounded-xl border border-line bg-surface p-4 text-sm">
              <h2 className="mb-2 font-semibold">Đã giao</h2>
              <ul className="grid gap-1.5">
                {asg.map((a) => (
                  <li key={a.id}><Link href={`/gv/bai-giao/${a.id}`} className="inline-flex min-h-9 items-center text-brand hover:underline">{a.title}</Link> <span className="text-muted">· {(a.classes as unknown as { name: string } | null)?.name}</span></li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
