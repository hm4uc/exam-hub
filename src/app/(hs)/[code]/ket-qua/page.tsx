import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, ButtonLink, cx } from '@/components/ui';
import { rpcMessage } from '@/lib/rpc-messages';
import { fmtDateTime, fmtNum, fmtScore, isCode } from '@/lib/format';
import { supabaseServer } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Kết quả' };

type QType = 'mcq' | 'tf' | 'short';
interface RQ { id: string; type: QType; stem_html: string; choices: { label: string; html: string }[]; answer: string | string[]; solution_html: string | null }
interface Result {
  attempt_id: string; title: string; code: string; submitted_at: string; tab_leaves: number;
  result_mode: 'none' | 'score' | 'score_answers'; visible: boolean; release_at: string;
  score?: number; score_raw?: number; score_max?: number;
  per_question?: Record<string, { pts: number; max: number; result: 'right' | 'part' | 'wrong' }>;
  answers?: Record<string, string>; questions?: RQ[];
}
const LETTERS = 'ABCD';
const RESULT_LABEL = { right: 'Đúng', part: 'Đúng một phần', wrong: 'Sai' } as const;

export default async function ResultPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ id?: string }> }) {
  const { code } = await params;
  const { id } = await searchParams;
  if (!isCode(code) || !id || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc('attempt_result', { p_attempt: id });
  if (error) return <main className="mx-auto max-w-xl px-4 py-8"><Alert>{rpcMessage(error)}</Alert></main>;
  const r = data as Result;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/" className="text-sm text-muted hover:text-brand">← Bài của tôi</Link>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">{r.title}</h1>
      <p className="mt-1 text-sm text-muted">Đã nộp lúc {fmtDateTime(r.submitted_at)}</p>

      <section className="mt-5 rounded-xl border border-line bg-surface p-5">
        {!r.visible ? (
          <>
            <p className="text-lg font-bold text-ok">Đã nộp bài thành công</p>
            <p className="mt-1 text-sm text-muted">
              {r.result_mode === 'none' ? 'Thầy cô sẽ thông báo điểm sau.' : `Điểm sẽ hiện sau khi bài đóng (${fmtDateTime(r.release_at)}).`}
            </p>
          </>
        ) : (
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <p className="grade-mark num text-6xl leading-none">{fmtScore(r.score)}</p>
            <p className="pb-1 text-sm text-muted">
              điểm (thang 10)<br />
              <span className="num">Đạt {fmtNum(r.score_raw)} / {fmtNum(r.score_max)} điểm câu hỏi</span>
            </p>
          </div>
        )}
      </section>

      {r.visible && r.questions && r.per_question && (
        <>
          <section className="mt-4 rounded-xl border border-line bg-surface p-4" aria-label="Phiếu kết quả">
            <div className="flex flex-wrap gap-2">
              {r.questions.map((q, i) => (
                <a key={q.id} href={`#c${i + 1}`} className="bubble" data-state={r.per_question![q.id]?.result ?? 'wrong'} aria-label={`Câu ${i + 1}: ${RESULT_LABEL[r.per_question![q.id]?.result ?? 'wrong']}`}>{i + 1}</a>
              ))}
            </div>
          </section>
          <div className="mt-4 grid gap-4">
            {r.questions.map((q, i) => {
              const pq = r.per_question![q.id];
              const given = r.answers?.[q.id];
              return (
                <article key={q.id} id={`c${i + 1}`} className="scroll-mt-4 rounded-xl border border-line bg-surface p-4 sm:p-5">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h2 className="font-bold">Câu {i + 1}</h2>
                    <span className={cx('rounded-full px-2.5 py-0.5 text-xs font-semibold', pq?.result === 'right' ? 'bg-ok-soft text-ok' : pq?.result === 'part' ? 'bg-warn-soft text-warn' : 'bg-pen-soft text-pen')}>
                      {RESULT_LABEL[pq?.result ?? 'wrong']} · <span className="num">{fmtNum(pq?.pts)}/{fmtNum(pq?.max)}</span>
                    </span>
                  </div>
                  <div className="rich" dangerouslySetInnerHTML={{ __html: q.stem_html }} />
                  {q.type === 'mcq' && (
                    <ul className="mt-3 grid gap-1.5">
                      {q.choices.map((c, k) => {
                        const correct = c.label === q.answer, picked = c.label === given;
                        return (
                          <li key={c.label} className={cx('flex items-start gap-3 rounded-lg border px-3 py-2', correct ? 'border-ok bg-ok-soft' : picked ? 'border-pen bg-pen-soft' : 'border-transparent')}>
                            <span className="bubble h-7 w-7 shrink-0 text-xs" data-state={correct ? 'right' : picked ? 'wrong' : 'empty'}>{LETTERS[k]}</span>
                            <span className="rich min-w-0 flex-1 pt-0.5" dangerouslySetInnerHTML={{ __html: c.html }} />
                            {picked && <span className="pt-0.5 text-xs font-semibold text-muted">Bạn chọn</span>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {q.type === 'tf' && (
                    <table className="mt-3 w-full text-sm">
                      <thead><tr className="text-left text-xs text-muted"><th className="py-1 font-medium">Ý</th><th className="py-1 font-medium">Bạn chọn</th><th className="py-1 font-medium">Đáp án</th></tr></thead>
                      <tbody>
                        {q.choices.map((c, j) => {
                          const g = (given ?? '____')[j], a = String(q.answer)[j];
                          const t = (x: string) => (x === 'Đ' ? 'Đúng' : x === 'S' ? 'Sai' : '—');
                          return (
                            <tr key={c.label} className="border-t border-line align-top">
                              <td className="py-2 pr-3"><b>{c.label})</b> <span className="rich" dangerouslySetInnerHTML={{ __html: c.html }} /></td>
                              <td className={cx('py-2 pr-3 font-semibold', g === a ? 'text-ok' : 'text-pen')}>{t(g)}</td>
                              <td className="py-2 font-semibold">{t(a)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                  {q.type === 'short' && (
                    <p className="mt-3 text-sm">
                      Bạn trả lời: <b className={cx('num', pq?.result === 'right' ? 'text-ok' : 'text-pen')}>{given || 'bỏ trống'}</b>
                      <span className="mx-2 text-line">|</span>Đáp án: <b className="num">{(q.answer as string[]).join(' hoặc ')}</b>
                    </p>
                  )}
                  {q.solution_html && (
                    <details className="mt-3 rounded-lg bg-sunken px-3 py-2 text-sm">
                      <summary className="cursor-pointer font-semibold text-brand">Lời giải</summary>
                      <div className="rich mt-2" dangerouslySetInnerHTML={{ __html: q.solution_html }} />
                    </details>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
      <ButtonLink href="/" variant="secondary" className="mt-6">Về trang của tôi</ButtonLink>
    </main>
  );
}
