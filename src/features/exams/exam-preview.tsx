'use client';
import { ArrowLeft, ChevronLeft, ChevronRight, Eye, EyeOff, LayoutList, Square } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, FieldError, cx } from '@/components/ui';
import { TYPE_NAME, type QType } from '@/domain/exam/types';
import { validateShortAnswerText } from '@/lib/validation';

export interface PreviewQuestion {
  id: string;
  position: number;
  part: string | null;
  type: QType;
  stem_html: string;
  choices: { label: string; html: string }[];
  answer: string | string[];
  solution_html: string | null;
}

const LETTERS = 'ABCD';
const isAnswered = (q: PreviewQuestion, v: string | undefined) =>
  !!v && (q.type === 'tf' ? v.length === 4 && !v.includes('_') : v.trim() !== '');

export function ExamPreviewClient({
  examId,
  title,
  questions,
}: {
  examId: string;
  title: string;
  questions: PreviewQuestion[];
}) {
  const [mode, setMode] = useState<'single' | 'all'>('single');
  const [showKey, setShowKey] = useState(false);
  const [cur, setCur] = useState(0);
  const [dir, setDir] = useState<'next' | 'prev'>('next');
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const goTo = (idx: number) => {
    setDir(idx >= cur ? 'next' : 'prev');
    setCur(idx);
  };

  if (!questions.length) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link href={`/gv/de/${examId}`} className="inline-flex min-h-10 items-center gap-1 text-sm text-muted hover:text-brand">
          <ArrowLeft className="h-4 w-4" aria-hidden />Quay lại sửa đề
        </Link>
        <p className="mt-4 rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">Đề chưa có câu hỏi nào.</p>
      </div>
    );
  }

  const doneCount = questions.filter((q) => isAnswered(q, answers[q.id])).length;
  const setAns = (qid: string, val: string) => setAnswers((a) => ({ ...a, [qid]: val }));
  const q = questions[cur];

  const renderCard = (item: PreviewQuestion, idx: number, animated = false) => (
    <article
      key={item.id}
      id={`pv-${idx + 1}`}
      className={cx(
        'scroll-mt-20 rounded-xl border border-line bg-surface p-4 shadow-card sm:p-6',
        animated && (dir === 'next' ? 'q-enter-next' : 'q-enter-prev'),
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-base font-bold">Câu {idx + 1}</h2>
        <span className="text-sm text-muted">· {TYPE_NAME[item.type]}</span>
        {item.part && <Badge>Phần {item.part}</Badge>}
      </div>
      <div className="rich text-[1.0625rem]" dangerouslySetInnerHTML={{ __html: item.stem_html }} />

      {item.type === 'mcq' && (
        <div className="mt-4 grid gap-2">
          {item.choices.map((c, i) => {
            const sel = answers[item.id] === c.label;
            const correct = showKey && item.answer === c.label;
            return (
              <button
                key={c.label}
                type="button"
                onClick={() => setAns(item.id, c.label)}
                className={cx(
                  'flex min-h-12 items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                  correct
                    ? 'border-ok bg-ok-soft'
                    : sel
                      ? 'border-brand bg-brand-soft'
                      : 'border-line hover:bg-sunken',
                )}
              >
                <span className="bubble h-8 w-8 shrink-0" data-state={correct ? 'right' : sel ? 'filled' : 'empty'}>
                  {LETTERS[i] ?? c.label}
                </span>
                <span className="rich min-w-0 flex-1 pt-1" dangerouslySetInnerHTML={{ __html: c.html }} />
                {correct && <Badge tone="ok" className="mt-1 shrink-0">Đáp án</Badge>}
              </button>
            );
          })}
        </div>
      )}

      {item.type === 'tf' && (
        <div className="mt-4 divide-y divide-line">
          {item.choices.map((c, j) => {
            const v = (answers[item.id] ?? '____').padEnd(4, '_')[j];
            const ansChar = String(item.answer)[j];
            const pick = (val: 'Đ' | 'S') => {
              const arr = (answers[item.id] ?? '____').padEnd(4, '_').split('');
              arr[j] = val;
              setAns(item.id, arr.join(''));
            };
            return (
              <div key={c.label} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <div className="min-w-0 flex-1 basis-56">
                  <b className="mr-1">{c.label})</b>
                  <span className="rich" dangerouslySetInnerHTML={{ __html: c.html }} />
                  {showKey && (
                    <Badge tone={ansChar === 'Đ' ? 'ok' : 'pen'} className="ml-2">
                      Đáp án: {ansChar === 'Đ' ? 'Đúng' : 'Sai'}
                    </Badge>
                  )}
                </div>
                <div className="inline-flex overflow-hidden rounded-lg border border-line" role="group" aria-label={`Ý ${c.label}`}>
                  <button type="button" aria-pressed={v === 'Đ'} onClick={() => pick('Đ')} className={cx('min-h-10 px-4 text-sm font-semibold', v === 'Đ' ? 'bg-ok text-surface' : 'bg-surface text-muted hover:bg-sunken')}>Đúng</button>
                  <button type="button" aria-pressed={v === 'S'} onClick={() => pick('S')} className={cx('min-h-10 border-l border-line px-4 text-sm font-semibold', v === 'S' ? 'bg-pen text-surface' : 'bg-surface text-muted hover:bg-sunken')}>Sai</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {item.type === 'short' && (() => {
        const shortErr = validateShortAnswerText(answers[item.id] ?? '', false);
        return (
          <div className="mt-4">
            <label htmlFor={`pv-sa-${item.id}`} className={cx('text-sm transition-colors', shortErr ? 'font-medium text-pen' : 'text-muted')}>
              Đáp số (chọn thử không lưu)
            </label>
            <input
              id={`pv-sa-${item.id}`}
              inputMode="decimal"
              autoComplete="off"
              maxLength={16}
              placeholder="Ví dụ: -2,5"
              value={answers[item.id] ?? ''}
              onChange={(e) => setAns(item.id, e.target.value)}
              aria-invalid={!!shortErr || undefined}
              className="mt-1.5 block w-full max-w-[14rem] rounded-xl border border-line bg-surface px-4 py-3 text-xl font-semibold tabular-nums transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 aria-[invalid=true]:border-pen aria-[invalid=true]:bg-pen-soft/35 aria-[invalid=true]:focus:border-pen aria-[invalid=true]:focus:ring-pen/25"
            />
            <FieldError error={shortErr} className="mt-1.5" />
            {showKey && (
              <p className="mt-2 text-sm text-ok">
                Đáp án: <b className="num">{(item.answer as string[]).join(' hoặc ')}</b>
              </p>
            )}
          </div>
        );
      })()}

      {showKey && item.solution_html && (
        <details className="mt-4 rounded-lg bg-sunken px-3 py-2 text-sm">
          <summary className="cursor-pointer py-2 font-semibold text-brand">Lời giải</summary>
          <div className="rich mt-2" dangerouslySetInnerHTML={{ __html: item.solution_html }} />
        </details>
      )}
    </article>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3.5 sm:p-4">
        <div className="min-w-0">
          <Link href={`/gv/de/${examId}`} className="-my-1 mb-0.5 inline-flex min-h-9 items-center gap-1 text-sm text-muted hover:text-brand">
            <ArrowLeft className="h-4 w-4" aria-hidden />Quay lại sửa đề
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">{title}</h1>
            <Badge tone="brand">Xem trước như học sinh</Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-lg border border-line bg-sunken/50 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={cx('inline-flex min-h-8 items-center gap-1 rounded-md px-2.5 transition-colors', mode === 'single' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}
            >
              <Square className="h-3.5 w-3.5" aria-hidden />Từng câu
            </button>
            <button
              type="button"
              onClick={() => setMode('all')}
              className={cx('inline-flex min-h-8 items-center gap-1 rounded-md px-2.5 transition-colors', mode === 'all' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}
            >
              <LayoutList className="h-3.5 w-3.5" aria-hidden />Cả đề
            </button>
          </div>
          <Button variant="secondary" className="min-h-9 px-3 text-xs" onClick={() => setShowKey((v) => !v)}>
            {showKey ? <><EyeOff className="h-3.5 w-3.5" aria-hidden />Ẩn đáp án</> : <><Eye className="h-3.5 w-3.5" aria-hidden />Hiện đáp án</>}
          </Button>
        </div>
      </div>

      <section aria-label="Phiếu câu hỏi" className="mb-4 rounded-xl border border-line bg-surface p-3 sm:p-4">
        <div className="mb-2 flex items-baseline justify-between gap-2 text-sm">
          <span className="font-semibold">Phiếu trả lời (thử chọn thoải mái, không lưu điểm)</span>
          <span className="num text-muted">{doneCount}/{questions.length} câu</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {questions.map((x, i) => (
            mode === 'single' ? (
              <button
                key={x.id}
                type="button"
                className="bubble"
                onClick={() => goTo(i)}
                data-state={isAnswered(x, answers[x.id]) ? 'filled' : 'empty'}
                data-current={i === cur}
              >
                {i + 1}
              </button>
            ) : (
              <a
                key={x.id}
                href={`#pv-${i + 1}`}
                className="bubble"
                data-state={isAnswered(x, answers[x.id]) ? 'filled' : 'empty'}
              >
                {i + 1}
              </a>
            )
          ))}
        </div>
      </section>

      {mode === 'single' ? (
        <div className="grid gap-4">
          {renderCard(q, cur, true)}
          <div className="flex items-center justify-between gap-3">
            <Button variant="secondary" onClick={() => goTo(cur - 1)} disabled={cur === 0}>
              <ChevronLeft className="h-4 w-4" aria-hidden />Câu trước
            </Button>
            <span className="num text-sm text-muted">Câu {cur + 1} / {questions.length}</span>
            <Button onClick={() => goTo(cur + 1)} disabled={cur === questions.length - 1}>
              Câu sau<ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {questions.map((item, idx) => renderCard(item, idx, false))}
        </div>
      )}
    </div>
  );
}
