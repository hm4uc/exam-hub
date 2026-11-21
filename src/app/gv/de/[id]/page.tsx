import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Eye, Plus } from 'lucide-react';
import { Badge, ButtonLink, PageTitle } from '@/components/ui';
import { DEFAULT_SCORING, type Scoring } from '@/domain/exam/types';
import { QuickLinkCard, type EditableAssignment } from '@/features/assignments/results-controls';
import { ExamMeta, QuestionList } from '@/features/exams/editor';
import type { QRow } from '@/features/exams/types';
import { supabaseServer } from '@/server/supabase/server';

export const metadata: Metadata = { title: 'Sửa đề' };

interface AsgRow {
  id: string;
  title: string;
  code: string;
  class_id: string | null;
  restrict_to_class: boolean;
  opens_at: string;
  closes_at: string | null;
  duration_minutes: number;
  max_attempts: number;
  shuffle_questions: boolean;
  shuffle_choices: boolean;
  access_password: string | null;
  result_mode: string;
  result_release: string;
  is_quick_link: boolean;
  classes: { name: string } | null;
  attempts: { count: number }[];
}

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await supabaseServer();
  const [{ data: exam }, { data: qs }, { data: asg }, { data: classes }] = await Promise.all([
    supabase.from('exams').select('id, title, status, scoring').eq('id', id).maybeSingle(),
    supabase.from('questions').select('id, position, part, type, stem, stem_html, choices, answer, solution, points').eq('exam_id', id).order('position'),
    supabase
      .from('assignments')
      .select('id, title, code, class_id, restrict_to_class, opens_at, closes_at, duration_minutes, max_attempts, shuffle_questions, shuffle_choices, access_password, result_mode, result_release, is_quick_link, classes(name), attempts(count)')
      .eq('exam_id', id)
      .order('is_quick_link', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('classes').select('id, name').is('archived_at', null).order('name'),
  ]);
  if (!exam) notFound();
  const scoring: Scoring = { ...DEFAULT_SCORING, ...(exam.scoring as Partial<Scoring>) };
  const list = (asg ?? []) as unknown as AsgRow[];
  const primary = list[0] ?? null;
  const totalAttempts = list.reduce((sum, a) => sum + (a.attempts?.[0]?.count ?? 0), 0);

  // Server Component: xác định trạng thái mở của link chính tại thời điểm request
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const primaryOpen = primary
    ? now >= new Date(primary.opens_at).getTime() && (!primary.closes_at || now < new Date(primary.closes_at).getTime())
    : false;

  const quickEditable: EditableAssignment | null = primary
    ? {
        id: primary.id,
        code: primary.code,
        title: primary.title,
        class_id: primary.class_id,
        restrict_to_class: primary.restrict_to_class,
        opens_at: primary.opens_at,
        closes_at: primary.closes_at,
        duration_minutes: primary.duration_minutes,
        max_attempts: primary.max_attempts,
        shuffle_questions: primary.shuffle_questions,
        shuffle_choices: primary.shuffle_choices,
        result_mode: primary.result_mode,
        result_release: primary.result_release,
        access_password: primary.access_password ?? '',
      }
    : null;

  return (
    <>
      <PageTitle title={exam.title} back={{ href: '/gv/de', label: 'Đề thi' }}>
        {exam.status === 'published' ? <Badge tone="ok" className="self-center">Đã xuất bản</Badge> : <Badge tone="warn" className="self-center">Nháp</Badge>}
        <ButtonLink variant="secondary" href={`/gv/de/${id}/xem-truoc`}><Eye className="h-4 w-4" aria-hidden />Xem trước</ButtonLink>
        <ButtonLink href={`/gv/de/${id}/giao`}><Plus className="h-4 w-4" aria-hidden />Tạo link mới / Giao lớp</ButtonLink>
      </PageTitle>

      <QuickLinkCard
        examId={id}
        quick={quickEditable}
        className={primary?.classes?.name ?? null}
        attemptCount={primary?.attempts?.[0]?.count ?? 0}
        open={primaryOpen}
        classes={classes ?? []}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <QuestionList questions={(qs ?? []) as QRow[]} scoring={scoring} locked={totalAttempts > 0} />
        <aside className="grid gap-4 lg:sticky lg:top-4">
          <ExamMeta id={id} title={exam.title} scoring={scoring} status={exam.status as 'draft' | 'published'} count={qs?.length ?? 0} />
          {list.length > 0 && (
            <section className="rounded-xl border border-line bg-surface p-4 text-sm">
              <h2 className="mb-2 font-semibold">Tất cả link làm bài ({list.length})</h2>
              <ul className="grid gap-1.5">
                {list.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2">
                    <Link href={`/gv/bai-giao/${a.id}`} className="min-w-0 truncate py-1 text-brand hover:underline">
                      {a.title}
                    </Link>
                    <span className="shrink-0 text-xs text-muted">
                      {a.classes?.name ? `Lớp ${a.classes.name}` : 'Tự do'} · {a.attempts?.[0]?.count ?? 0} lượt
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
