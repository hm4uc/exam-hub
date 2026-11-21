import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge, PageTitle, cx } from '@/components/ui';
import { fmtDateTime, fmtNum, fmtScore } from '@/lib/format';
import { DeleteAttemptButton } from '@/features/accounts/account-editor';
import { supabaseServer } from '@/server/supabase/server';

export const metadata: Metadata = { title: 'Bài làm' };

const RESULT = { right: ['Đúng', 'ok'], part: ['Đúng một phần', 'warn'], wrong: ['Sai', 'pen'] } as const;

export default async function AttemptDetail({ params }: { params: Promise<{ id: string; aid: string }> }) {
  const { id, aid } = await params;
  if (!/^[0-9a-f-]{36}$/.test(aid)) notFound();
  const supabase = await supabaseServer();
  const { data: t } = await supabase
    .from('attempts')
    .select('id, attempt_no, started_at, submitted_at, question_order, answers, score, score_raw, score_max, per_question, tab_leaves, guest_name, profiles(full_name, username), assignments(title, exam_id)')
    .eq('id', aid)
    .maybeSingle();
  if (!t) notFound();
  const asg = t.assignments as unknown as { title: string; exam_id: string };
  const st = t.profiles as unknown as { full_name: string; username: string } | null;
  const studentLabel = st?.full_name ?? t.guest_name ?? 'Học sinh (Khách)';
  const { data: qs } = await supabase.from('questions').select('id, type, stem_html, choices, answer').eq('exam_id', asg.exam_id);
  const byId = new Map((qs ?? []).map((q) => [q.id, q]));
  const order = (t.question_order as string[]).map((qid) => byId.get(qid)).filter(Boolean) as NonNullable<ReturnType<typeof byId.get>>[];
  const answers = (t.answers ?? {}) as Record<string, string>;
  const per = (t.per_question ?? {}) as Record<string, { pts: number; max: number; result: keyof typeof RESULT }>;

  return (
    <>
      <PageTitle title={studentLabel} back={{ href: `/gv/bai-giao/${id}`, label: asg.title }}>
        {!st && <Badge className="self-center">Khách (không đăng nhập)</Badge>}
        <DeleteAttemptButton id={aid} back={`/gv/bai-giao/${id}`} label="Xoá bài làm (cho làm lại)" />
      </PageTitle>
      <div className="mb-5 flex flex-wrap items-end gap-x-8 gap-y-2 rounded-xl border border-line bg-surface p-4">
        <p className="grade-mark num text-5xl leading-none">{t.submitted_at ? fmtScore(t.score) : '—'}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
          <dt className="text-muted">Lượt</dt><dd className="num">{t.attempt_no}</dd>
          <dt className="text-muted">Bắt đầu</dt><dd className="num">{fmtDateTime(t.started_at)}</dd>
          <dt className="text-muted">Nộp</dt><dd className="num">{t.submitted_at ? fmtDateTime(t.submitted_at) : 'Chưa nộp'}</dd>
          <dt className="text-muted">Rời trang</dt><dd className="num">{t.tab_leaves} lần</dd>
        </dl>
      </div>
      <ol className="grid gap-3">
        {order.map((q, i) => {
          const r = per[q.id];
          const given = answers[q.id];
          const choices = q.choices as { label: string; html: string }[];
          return (
            <li key={q.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="mb-2 flex items-center gap-2">
                <b>Câu {i + 1}</b>
                {r && <Badge tone={RESULT[r.result][1]}>{RESULT[r.result][0]} · <span className="num">{fmtNum(r.pts)}/{fmtNum(r.max)}</span></Badge>}
              </div>
              <div className="rich" dangerouslySetInnerHTML={{ __html: q.stem_html }} />
              {q.type === 'mcq' && (
                <ul className="mt-2 grid gap-1">
                  {choices.map((c) => (
                    <li key={c.label} className={cx('flex gap-2 rounded-lg px-2 py-1', c.label === q.answer && 'bg-ok-soft', c.label === given && c.label !== q.answer && 'bg-pen-soft')}>
                      <b>{c.label}.</b><span className="rich min-w-0 flex-1" dangerouslySetInnerHTML={{ __html: c.html }} />
                      {c.label === given && <span className="text-xs font-semibold text-muted">HS chọn</span>}
                    </li>
                  ))}
                </ul>
              )}
              {q.type === 'tf' && (
                <p className="num mt-2 text-sm">HS chọn: <b>{(given ?? '____').replace(/_/g, '–')}</b> · Đáp án: <b>{String(q.answer)}</b></p>
              )}
              {q.type === 'short' && (
                <p className="num mt-2 text-sm">HS trả lời: <b>{given || 'bỏ trống'}</b> · Đáp án: <b>{(q.answer as string[]).join(' hoặc ')}</b></p>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
