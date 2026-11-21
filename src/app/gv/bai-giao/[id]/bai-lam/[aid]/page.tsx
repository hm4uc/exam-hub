import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge, PageTitle } from '@/components/ui';
import type { PerQuestionScore, ReviewChoice, ReviewQuestionInput } from '@/domain/exam/review';
import type { QType } from '@/domain/exam/types';
import { DeleteAttemptButton } from '@/features/accounts/account-editor';
import { AttemptReview } from '@/features/review/attempt-review';
import { supabaseServer } from '@/server/supabase/server';

export const metadata: Metadata = { title: 'Bài làm' };

export default async function AttemptDetail({ params }: { params: Promise<{ id: string; aid: string }> }) {
  const { id, aid } = await params;
  if (!/^[0-9a-f-]{36}$/.test(aid)) notFound();
  const supabase = await supabaseServer();
  const { data: t } = await supabase
    .from('attempts')
    .select('id, attempt_no, started_at, submitted_at, question_order, choice_orders, answers, score, score_raw, score_max, per_question, tab_leaves, guest_name, profiles(full_name, username), assignments(title, exam_id)')
    .eq('id', aid)
    .maybeSingle();
  if (!t) notFound();
  const asg = t.assignments as unknown as { title: string; exam_id: string };
  const st = t.profiles as unknown as { full_name: string; username: string } | null;
  const studentLabel = st?.full_name ?? t.guest_name ?? 'Học sinh (Khách)';
  const { data: qs } = await supabase
    .from('questions')
    .select('id, type, stem_html, choices, answer, solution_html')
    .eq('exam_id', asg.exam_id);

  const byId = new Map((qs ?? []).map((q) => [q.id, q]));
  const orderedQuestions: ReviewQuestionInput[] = (t.question_order as string[])
    .map((qid) => byId.get(qid))
    .filter((q): q is NonNullable<typeof q> => Boolean(q))
    .map((q) => ({
      id: q.id,
      type: q.type as QType,
      stem_html: q.stem_html,
      choices: (q.choices ?? []) as ReviewChoice[],
      answer: q.answer as string | string[],
      solution_html: q.solution_html ?? null,
    }));

  return (
    <>
      <PageTitle title={studentLabel} back={{ href: `/gv/bai-giao/${id}`, label: asg.title }}>
        {!st && <Badge className="self-center">Khách (không đăng nhập)</Badge>}
        {st && <Badge tone="neutral" className="self-center">{st.username}</Badge>}
        <DeleteAttemptButton id={aid} back={`/gv/bai-giao/${id}`} label="Xoá bài làm (cho làm lại)" />
      </PageTitle>

      <AttemptReview
        viewer="teacher"
        score={t.score != null ? Number(t.score) : null}
        scoreRaw={t.score_raw != null ? Number(t.score_raw) : null}
        scoreMax={t.score_max != null ? Number(t.score_max) : null}
        startedAt={t.started_at}
        submittedAt={t.submitted_at}
        attemptNo={t.attempt_no}
        tabLeaves={t.tab_leaves}
        questions={orderedQuestions}
        answers={(t.answers ?? {}) as Record<string, string>}
        perQuestion={(t.per_question ?? {}) as Record<string, PerQuestionScore>}
        choiceOrders={(t.choice_orders ?? {}) as Record<string, number[]>}
      />
    </>
  );
}
