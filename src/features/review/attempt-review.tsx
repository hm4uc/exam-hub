'use client';
import { Check, CheckCircle2, CircleAlert, Clock, EyeOff, MinusCircle, X, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, cx } from '@/components/ui';
import {
  buildReviewItems,
  formatDuration,
  summarizeReview,
  type PerQuestionScore,
  type ReviewQuestionInput,
  type ReviewStatus,
} from '@/domain/exam/review';
import { TYPE_NAME } from '@/domain/exam/types';
import { fmtDateTime, fmtNum, fmtScore } from '@/lib/format';

const LETTERS = 'ABCDEF';

const STATUS_META: Record<
  ReviewStatus,
  { label: string; short: string; tone: 'ok' | 'warn' | 'pen' | 'neutral'; Icon: typeof CheckCircle2 }
> = {
  right: { label: 'Đúng', short: 'Đúng', tone: 'ok', Icon: CheckCircle2 },
  part: { label: 'Đúng một phần', short: 'Một phần', tone: 'warn', Icon: CircleAlert },
  wrong: { label: 'Sai', short: 'Sai', tone: 'pen', Icon: XCircle },
  blank: { label: 'Bỏ trống', short: 'Bỏ trống', tone: 'neutral', Icon: MinusCircle },
};

export interface AttemptReviewProps {
  viewer: 'teacher' | 'student';
  score: number | null;
  scoreRaw: number | null;
  scoreMax: number | null;
  submittedAt: string | null;
  startedAt?: string | null;
  attemptNo?: number | null;
  tabLeaves?: number | null;
  questions: ReviewQuestionInput[];
  answers: Record<string, string> | null;
  perQuestion: Record<string, PerQuestionScore> | null;
  choiceOrders?: Record<string, number[]> | null;
}

export function AttemptReview({
  viewer,
  score,
  scoreRaw,
  scoreMax,
  submittedAt,
  startedAt,
  attemptNo,
  tabLeaves,
  questions,
  answers,
  perQuestion,
  choiceOrders,
}: AttemptReviewProps) {
  const [filter, setFilter] = useState<'all' | ReviewStatus>('all');
  const [flashId, setFlashId] = useState<string | null>(null);

  const items = useMemo(
    () => buildReviewItems(questions, answers, perQuestion, choiceOrders),
    [questions, answers, perQuestion, choiceOrders],
  );
  const summary = useMemo(() => summarizeReview(items), [items]);
  const visibleItems = useMemo(
    () => (filter === 'all' ? items : items.filter((it) => it.status === filter)),
    [filter, items],
  );
  const durationText = formatDuration(startedAt, submittedAt);
  const actorPick = viewer === 'teacher' ? 'HS chọn' : 'Bạn chọn';
  const actorReply = viewer === 'teacher' ? 'Học sinh trả lời' : 'Bạn trả lời';

  function jumpToQuestion(qid: string, idx: number) {
    const target = items[idx];
    if (filter !== 'all' && target && target.status !== filter) {
      setFilter('all');
    }
    setFlashId(qid);
    requestAnimationFrame(() => {
      document.getElementById(`rv-c${idx + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    setTimeout(() => setFlashId((cur) => (cur === qid ? null : cur)), 850);
  }

  const filterTabs: { id: 'all' | ReviewStatus; label: string; count: number; tone?: 'ok' | 'warn' | 'pen' | 'neutral' }[] = [
    { id: 'all', label: 'Tất cả', count: summary.total },
    ...(summary.wrong > 0 ? [{ id: 'wrong' as const, label: 'Sai', count: summary.wrong, tone: 'pen' as const }] : []),
    ...(summary.part > 0 ? [{ id: 'part' as const, label: 'Một phần', count: summary.part, tone: 'warn' as const }] : []),
    ...(summary.blank > 0 ? [{ id: 'blank' as const, label: 'Bỏ trống', count: summary.blank, tone: 'neutral' as const }] : []),
    ...(summary.right > 0 ? [{ id: 'right' as const, label: 'Đúng', count: summary.right, tone: 'ok' as const }] : []),
  ];

  const isGraded = submittedAt !== null;

  return (
    <div className="grid gap-4">
      {/* 1. Tổng quan điểm số + thanh phân bổ trực quan */}
      <section className="grid gap-4 rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
            <p className="grade-mark grade-stamp num text-5xl leading-none sm:text-6xl">
              {isGraded ? fmtScore(score) : '—'}
            </p>
            <div className="pb-0.5 text-sm text-muted">
              <p className="font-medium text-ink">{isGraded ? 'điểm (thang 10)' : 'Đang làm bài (chưa nộp)'}</p>
              {isGraded && scoreMax != null && (
                <p className="num mt-0.5">Đạt {fmtNum(scoreRaw)} / {fmtNum(scoreMax)} điểm câu hỏi</p>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:text-sm">
            {durationText && (
              <div>
                <dt className="flex items-center gap-1 text-muted"><Clock className="h-3.5 w-3.5" aria-hidden />Thời gian làm</dt>
                <dd className="num font-semibold text-ink">{durationText}</dd>
              </div>
            )}
            {attemptNo != null && (
              <div>
                <dt className="text-muted">Lượt làm</dt>
                <dd className="num font-semibold text-ink">Lượt {attemptNo}</dd>
              </div>
            )}
            {submittedAt && (
              <div>
                <dt className="text-muted">Nộp lúc</dt>
                <dd className="num font-medium text-ink">{fmtDateTime(submittedAt)}</dd>
              </div>
            )}
            {viewer === 'teacher' && tabLeaves != null && (
              <div>
                <dt className="flex items-center gap-1 text-muted"><EyeOff className="h-3.5 w-3.5" aria-hidden />Rời trang</dt>
                <dd className={cx('num font-semibold', tabLeaves >= 3 ? 'text-warn' : 'text-ink')}>
                  {tabLeaves} lần
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Thanh tỷ lệ trực quan: Đúng / Đúng một phần / Sai / Bỏ trống */}
        {isGraded && summary.total > 0 && (
          <div className="grid gap-2.5 border-t border-line pt-4">
            <div
              className="flex h-3 w-full overflow-hidden rounded-full bg-sunken"
              role="img"
              aria-label={`Đúng ${summary.right}/${summary.total}, đúng một phần ${summary.part}, sai ${summary.wrong}, bỏ trống ${summary.blank}`}
            >
              {summary.right > 0 && (
                <div
                  className="bar-grow h-full bg-ok"
                  style={{ width: `${(summary.right / summary.total) * 100}%` }}
                  title={`Đúng: ${summary.right} câu (${summary.rightPct}%)`}
                />
              )}
              {summary.part > 0 && (
                <div
                  className="bar-grow h-full bg-warn"
                  style={{ width: `${(summary.part / summary.total) * 100}%`, animationDelay: '60ms' }}
                  title={`Đúng một phần: ${summary.part} câu (${summary.partPct}%)`}
                />
              )}
              {summary.wrong > 0 && (
                <div
                  className="bar-grow h-full bg-pen"
                  style={{ width: `${(summary.wrong / summary.total) * 100}%`, animationDelay: '120ms' }}
                  title={`Sai: ${summary.wrong} câu (${summary.wrongPct}%)`}
                />
              )}
              {summary.blank > 0 && (
                <div
                  className="bar-grow h-full bg-muted/25"
                  style={{ width: `${(summary.blank / summary.total) * 100}%`, animationDelay: '180ms' }}
                  title={`Bỏ trống: ${summary.blank} câu (${summary.blankPct}%)`}
                />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm">
              <span className="inline-flex items-center gap-1.5 font-medium text-ok">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                <span className="num">{summary.right} đúng</span>
                <span className="num text-muted">({summary.rightPct}%)</span>
              </span>
              {summary.part > 0 && (
                <span className="inline-flex items-center gap-1.5 font-medium text-warn">
                  <CircleAlert className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="num">{summary.part} một phần</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 font-medium text-pen">
                <XCircle className="h-4 w-4 shrink-0" aria-hidden />
                <span className="num">{summary.wrong} sai</span>
              </span>
              {summary.blank > 0 && (
                <span className="inline-flex items-center gap-1.5 font-medium text-muted">
                  <MinusCircle className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="num">{summary.blank} bỏ trống</span>
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 2. Bộ lọc trạng thái + Phiếu trả lời chấm màu */}
      {items.length > 0 && (
        <section className="grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-card" aria-label="Phiếu kết quả và bộ lọc">
          {isGraded && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc câu hỏi theo kết quả">
                {filterTabs.map((tab) => {
                  const active = filter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFilter(tab.id)}
                      className={cx(
                        'inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors',
                        active
                          ? 'border-brand bg-brand text-brand-on'
                          : 'border-line bg-surface text-muted hover:border-brand/50 hover:text-ink',
                      )}
                    >
                      <span>{tab.label}</span>
                      <span className={cx('num rounded-full px-1.5 py-0.25 text-[11px]', active ? 'bg-white/20 text-brand-on' : 'bg-sunken text-ink')}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>
              <span className="text-xs text-muted">Bấm số câu để nhảy nhanh</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {items.map((it) => {
              const dimmed = filter !== 'all' && it.status !== filter;
              const bubbleState = !isGraded ? (it.status === 'blank' ? 'blank' : 'filled') : it.status;
              return (
                <button
                  key={it.question.id}
                  type="button"
                  onClick={() => jumpToQuestion(it.question.id, it.index)}
                  className={cx('bubble', dimmed && 'opacity-30 hover:opacity-80')}
                  data-state={bubbleState}
                  aria-label={`Câu ${it.index + 1}: ${isGraded ? STATUS_META[it.status].label : it.status === 'blank' ? 'Chưa làm' : 'Đã làm'}`}
                >
                  {it.index + 1}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. Danh sách câu hỏi trực quan */}
      <ol className="grid gap-3.5">
        {visibleItems.map((it) => {
          const { question: q, given, index, status, pts, max } = it;
          const meta = STATUS_META[status];
          const Icon = meta.Icon;

          return (
            <li
              key={q.id}
              id={`rv-c${index + 1}`}
              className={cx(
                'scroll-mt-4 rounded-xl border border-line bg-surface p-4 shadow-card transition-shadow sm:p-5',
                flashId === q.id && 'card-flash border-brand',
              )}
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold">Câu {index + 1}</h2>
                <span className="text-xs text-muted">· {TYPE_NAME[q.type]}</span>
                {isGraded ? (
                  <Badge tone={meta.tone} className="ml-auto">
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {meta.label}
                    {max > 0 && <span className="num">· {fmtNum(pts)}/{fmtNum(max)}</span>}
                  </Badge>
                ) : (
                  <Badge tone={status === 'blank' ? 'neutral' : 'brand'} className="ml-auto">
                    {status === 'blank' ? 'Chưa trả lời' : 'Đã trả lời'}
                  </Badge>
                )}
              </div>

              <div className="rich text-[1.03125rem]" dangerouslySetInnerHTML={{ __html: q.stem_html }} />

              {/* Trắc nghiệm nhiều lựa chọn */}
              {q.type === 'mcq' && (
                <div className="mt-3.5 grid gap-2">
                  {status === 'blank' && (
                    <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
                      <MinusCircle className="h-3.5 w-3.5" aria-hidden />Bỏ trống — chưa chọn phương án nào.
                    </p>
                  )}
                  <ul className="grid gap-1.5">
                    {q.choices.map((c, k) => {
                      const correct = c.label === q.answer;
                      const picked = c.label === given;
                      const bubbleState = correct ? 'right' : picked ? 'wrong' : 'empty';
                      return (
                        <li
                          key={c.label}
                          className={cx(
                            'flex items-start gap-3 rounded-lg border px-3 py-2.5',
                            correct
                              ? 'border-ok/60 bg-ok-soft'
                              : picked
                                ? 'border-pen/60 bg-pen-soft'
                                : 'border-line/60 bg-surface',
                          )}
                        >
                          <span className="bubble pointer-events-none h-7 w-7 shrink-0 text-xs sm:h-7 sm:w-7" data-state={bubbleState}>
                            {LETTERS[k] ?? c.label}
                          </span>
                          <span className="rich min-w-0 flex-1 pt-0.5 text-sm sm:text-base" dangerouslySetInnerHTML={{ __html: c.html }} />
                          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 pt-0.5">
                            {picked && (
                              <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', correct ? 'bg-ok text-surface' : 'bg-pen text-surface')}>
                                {correct ? <Check className="h-3 w-3" aria-hidden /> : <X className="h-3 w-3" aria-hidden />}
                                {actorPick}
                              </span>
                            )}
                            {correct && !picked && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-ok/15 px-2 py-0.5 text-[11px] font-semibold text-ok">
                                <Check className="h-3 w-3" aria-hidden />Đáp án đúng
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Đúng / Sai 4 ý */}
              {q.type === 'tf' && (
                <ul className="mt-3.5 divide-y divide-line overflow-hidden rounded-lg border border-line">
                  {q.choices.map((c, j) => {
                    const g = (given ?? '____')[j];
                    const a = String(q.answer)[j];
                    const match = g === a;
                    const missing = g !== 'Đ' && g !== 'S';
                    const textOf = (x: string) => (x === 'Đ' ? 'Đúng' : x === 'S' ? 'Sai' : 'Bỏ trống');
                    return (
                      <li key={c.label} className={cx('flex flex-wrap items-start justify-between gap-3 px-3 py-2.5 text-sm', match ? 'bg-ok-soft/35' : !missing ? 'bg-pen-soft/35' : 'bg-surface')}>
                        <div className="min-w-0 flex-1 basis-56">
                          <b className="mr-1.5">{c.label})</b>
                          <span className="rich" dangerouslySetInnerHTML={{ __html: c.html }} />
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
                          <span
                            className={cx(
                              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold',
                              match ? 'bg-ok-soft text-ok' : missing ? 'bg-sunken text-muted' : 'bg-pen-soft text-pen',
                            )}
                          >
                            {match ? <Check className="h-3.5 w-3.5" aria-hidden /> : missing ? <MinusCircle className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
                            {actorPick}: {textOf(g)}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-sunken px-2.5 py-1 font-semibold text-ink">
                            Đáp án: {textOf(a)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Trả lời ngắn */}
              {q.type === 'short' && (
                <div className="mt-3.5 grid gap-2 sm:grid-cols-2">
                  <div className={cx('rounded-lg border px-3.5 py-2.5', status === 'right' ? 'border-ok/50 bg-ok-soft' : status === 'blank' ? 'border-line bg-sunken/50' : 'border-pen/50 bg-pen-soft')}>
                    <p className="text-xs text-muted">{actorReply}</p>
                    <p className={cx('num mt-0.5 text-base font-bold', status === 'right' ? 'text-ok' : status === 'blank' ? 'italic text-muted' : 'text-pen')}>
                      {given?.trim() || 'Bỏ trống'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-ok/40 bg-ok-soft/45 px-3.5 py-2.5">
                    <p className="text-xs text-muted">Đáp án đúng</p>
                    <p className="num mt-0.5 text-base font-bold text-ok">
                      {(q.answer as string[]).join(' hoặc ')}
                    </p>
                  </div>
                </div>
              )}

              {/* Lời giải */}
              {q.solution_html && (
                <details className="mt-3.5 rounded-lg bg-sunken/70 px-3.5 py-2 text-sm">
                  <summary className="cursor-pointer py-1.5 font-semibold text-brand">Xem lời giải chi tiết</summary>
                  <div className="rich mt-2 border-t border-line/60 pt-2" dangerouslySetInnerHTML={{ __html: q.solution_html }} />
                </details>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
