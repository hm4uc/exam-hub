'use client';
import { Pencil, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { AnswerPicker } from './answer-picker';
import { Rich } from './rich';
import { Alert, Badge, Button, Field, FieldError, Input, Textarea, cx } from '@/components/ui';
import { normTF } from '@/domain/exam/parse';
import { imagePublicUrl } from '@/domain/exam/question-io';
import { TYPE_NAME, type Scoring } from '@/domain/exam/types';
import { hasErrors, validatePointValue, validateShortAnswerList, validateTitle, type FieldErrors } from '@/lib/validation';
import { deleteExam, deleteQuestion, setExamStatus, updateExamMeta, updateQuestion } from './actions';
import type { QRow } from './types';

const imageUrl = (ref: string) => (ref.includes('/') ? imagePublicUrl(ref) : null);

export function QuestionList({ questions, scoring, locked }: { questions: QRow[]; scoring: Scoring; locked: boolean }) {
  return (
    <ol className="grid gap-3">
      {questions.map((q, i) => <QuestionCard key={q.id} q={q} index={i} scoring={scoring} locked={locked} />)}
    </ol>
  );
}

function QuestionCard({ q, index, scoring, locked }: { q: QRow; index: number; scoring: Scoring; locked: boolean }) {
  const [editing, setEditing] = useState(false);
  const [stem, setStem] = useState(q.stem);
  const [choices, setChoices] = useState(q.choices.map((c) => ({ label: c.label, text: c.text })));
  const [answer, setAnswer] = useState<string | string[]>(q.answer);
  const [solution, setSolution] = useState(q.solution ?? '');
  const [points, setPoints] = useState(q.points == null ? '' : String(q.points));
  const [errs, setErrs] = useState<FieldErrors>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const pts = q.points ?? scoring[q.type];

  const validateAnswer = (ans: string | string[]) => {
    if (q.type === 'mcq') return typeof ans === 'string' && choices.some((c) => c.label === ans) ? undefined : 'Chọn một đáp án đúng.';
    if (q.type === 'tf') return typeof ans === 'string' && normTF(ans)?.length === choices.length ? undefined : `Chọn Đúng hoặc Sai cho đủ cả ${choices.length} ý.`;
    return validateShortAnswerList(Array.isArray(ans) ? ans : undefined);
  };

  const validateAll = (): FieldErrors => {
    const next: FieldErrors = {
      stem: stem.trim() ? undefined : 'Vui lòng nhập nội dung câu hỏi.',
      answer: validateAnswer(answer),
      points: validatePointValue(points, true),
    };
    if (q.type !== 'short') {
      choices.forEach((c, j) => {
        if (!c.text.trim()) next[`choice-${j}`] = `Vui lòng nhập nội dung ${q.type === 'mcq' ? 'phương án' : 'ý'} ${c.label}.`;
      });
    }
    return next;
  };

  const save = () => {
    const nextErrs = validateAll();
    if (hasErrors(nextErrs)) {
      setErrs(nextErrs);
      setMsg(null);
      return;
    }
    setErrs({});
    start(async () => {
      const res = await updateQuestion(q.id, {
        position: q.position, part: q.part, type: q.type, stem, choices, answer,
        solution: solution.trim() ? solution : null, points: points.trim() === '' ? null : Number(points.replace(',', '.')),
      });
      setMsg(res.ok ? { ok: true, text: res.message ?? 'Đã lưu.' } : { ok: false, text: res.error });
      if (res.ok) setEditing(false);
    });
  };
  const remove = () => start(async () => {
    const res = await deleteQuestion(q.id);
    if (!res.ok) setMsg({ ok: false, text: res.error });
  });

  return (
    <li className="rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <b>Câu {index + 1}</b>
        <Badge tone="brand">{TYPE_NAME[q.type]}</Badge>
        {q.part && <span className="text-xs text-muted">Phần {q.part}</span>}
        <span className="num text-xs text-muted">{String(pts).replace('.', ',')} điểm</span>
        <div className="ml-auto flex gap-1">
          {!editing && <Button variant="ghost" className="min-h-9 px-2.5" onClick={() => { setEditing(true); setMsg(null); }}><Pencil className="h-4 w-4" aria-hidden />Sửa</Button>}
          {!locked && !editing && <Button variant="ghost" className="min-h-9 px-2.5 text-pen hover:bg-pen-soft" onClick={remove} disabled={pending} aria-label={`Xoá câu ${index + 1}`}><Trash2 className="h-4 w-4" aria-hidden /></Button>}
        </div>
      </div>
      {msg && <Alert tone={msg.ok ? 'ok' : 'pen'} className="mb-2">{msg.text}</Alert>}

      {!editing ? (
        <>
          <div className="rich" dangerouslySetInnerHTML={{ __html: q.stem_html }} />
          {q.type !== 'short' && (
            <ul className="mt-2 grid gap-1">
              {q.choices.map((c, j) => {
                const correct = q.type === 'mcq' ? q.answer === c.label : String(q.answer)[j] === 'Đ';
                return (
                  <li key={c.label} className={cx('flex gap-2 rounded-lg px-2 py-1', correct && 'bg-ok-soft')}>
                    <b className="shrink-0">{c.label}{q.type === 'mcq' ? '.' : ')'}</b>
                    <span className="rich min-w-0 flex-1" dangerouslySetInnerHTML={{ __html: c.html }} />
                    {q.type === 'tf' && <span className={cx('text-xs font-semibold', correct ? 'text-ok' : 'text-pen')}>{correct ? 'Đúng' : 'Sai'}</span>}
                  </li>
                );
              })}
            </ul>
          )}
          {q.type === 'short' && <p className="mt-2 text-sm">Đáp án: <b className="num">{(q.answer as string[]).join(' hoặc ')}</b></p>}
          {q.solution && <details className="mt-2 text-sm"><summary className="cursor-pointer py-2.5 font-medium text-brand">Lời giải</summary><Rich src={q.solution} imageUrl={imageUrl} className="mt-1 text-muted" /></details>}
        </>
      ) : (
        <div className="grid gap-4">
          <p className="text-xs text-muted">Viết công thức trong <code>\( … \)</code> bằng LaTeX, ví dụ <code>\(\frac{'{1}{2}'}\)</code>. Xem trước hiện ngay bên dưới ô nhập.</p>
          <Field label="Nội dung câu hỏi" htmlFor={`stem-${q.id}`} error={errs.stem}>
            <Textarea
              id={`stem-${q.id}`}
              value={stem}
              invalid={!!errs.stem}
              onChange={(e) => {
                const v = e.target.value;
                setStem(v);
                if (errs.stem) setErrs((p) => ({ ...p, stem: v.trim() ? undefined : 'Vui lòng nhập nội dung câu hỏi.' }));
              }}
              onBlur={() => setErrs((p) => ({ ...p, stem: stem.trim() ? undefined : 'Vui lòng nhập nội dung câu hỏi.' }))}
              rows={3}
            />
            <div className="rounded-lg bg-sunken px-3 py-2"><Rich src={stem} imageUrl={imageUrl} /></div>
          </Field>
          {q.type !== 'short' && choices.map((c, j) => {
            const cKey = `choice-${j}`;
            const cErr = errs[cKey];
            return (
              <Field key={c.label} label={`${q.type === 'mcq' ? 'Phương án' : 'Ý'} ${c.label}`} htmlFor={`c-${q.id}-${j}`} error={cErr}>
                <Input
                  id={`c-${q.id}-${j}`}
                  value={c.text}
                  invalid={!!cErr}
                  onChange={(e) => {
                    const v = e.target.value;
                    setChoices((cs) => cs.map((x, k) => (k === j ? { ...x, text: v } : x)));
                    if (cErr) setErrs((p) => ({ ...p, [cKey]: v.trim() ? undefined : `Vui lòng nhập nội dung ${q.type === 'mcq' ? 'phương án' : 'ý'} ${c.label}.` }));
                  }}
                  onBlur={() => setErrs((p) => ({ ...p, [cKey]: c.text.trim() ? undefined : `Vui lòng nhập nội dung ${q.type === 'mcq' ? 'phương án' : 'ý'} ${c.label}.` }))}
                />
                <div className="rounded-lg bg-sunken px-3 py-1.5"><Rich src={c.text} imageUrl={imageUrl} /></div>
              </Field>
            );
          })}
          <div className="grid gap-1.5">
            <span className={cx('text-sm font-medium', errs.answer && 'text-pen')}>Đáp án đúng</span>
            <AnswerPicker
              type={q.type}
              labels={choices.map((c) => c.label)}
              value={answer}
              error={errs.answer}
              onChange={(v) => {
                setAnswer(v);
                if (errs.answer) setErrs((p) => ({ ...p, answer: validateAnswer(v) }));
              }}
              idPrefix={q.id}
            />
          </div>
          <Field label="Lời giải (không bắt buộc)" htmlFor={`sol-${q.id}`}>
            <Textarea id={`sol-${q.id}`} value={solution} onChange={(e) => setSolution(e.target.value)} rows={3} />
          </Field>
          <Field label="Điểm của câu" htmlFor={`pts-${q.id}`} hint={`Để trống = theo thang chung (${String(scoring[q.type]).replace('.', ',')} điểm).`} error={errs.points}>
            <Input
              id={`pts-${q.id}`}
              value={points}
              invalid={!!errs.points}
              onChange={(e) => {
                const v = e.target.value;
                setPoints(v);
                if (errs.points) setErrs((p) => ({ ...p, points: validatePointValue(v, true) }));
              }}
              onBlur={() => setErrs((p) => ({ ...p, points: validatePointValue(points, true) }))}
              inputMode="decimal"
              className="max-w-[8rem]"
            />
          </Field>
          <div className="flex gap-2">
            <Button onClick={save} disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu câu này'}</Button>
            <Button variant="secondary" onClick={() => { setEditing(false); setErrs({}); setStem(q.stem); setChoices(q.choices.map((c) => ({ label: c.label, text: c.text }))); setAnswer(q.answer); setSolution(q.solution ?? ''); setPoints(q.points == null ? '' : String(q.points)); }} disabled={pending}>Huỷ</Button>
          </div>
        </div>
      )}
    </li>
  );
}

export function ExamMeta({ id, title: t0, scoring: s0, status, count }: { id: string; title: string; scoring: Scoring; status: 'draft' | 'published'; count: number }) {
  const [title, setTitle] = useState(t0);
  const [s, setS] = useState({ mcq: String(s0.mcq), tf: String(s0.tf), short: String(s0.short), scale10: s0.scale10 });
  const [errs, setErrs] = useState<FieldErrors>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [pending, start] = useTransition();
  const num = (x: string) => Number(x.replace(',', '.'));

  const save = () => {
    const nextErrs: FieldErrors = {
      title: validateTitle(title, 'tên đề'),
      mcq: validatePointValue(s.mcq, false),
      tf: validatePointValue(s.tf, false),
      short: validatePointValue(s.short, false),
    };
    if (hasErrors(nextErrs)) {
      setErrs(nextErrs);
      setMsg(null);
      return;
    }
    setErrs({});
    start(async () => {
      const res = await updateExamMeta(id, { title, scoring: { mcq: num(s.mcq), tf: num(s.tf), short: num(s.short), scale10: s.scale10 } });
      setMsg(res.ok ? { ok: true, text: 'Đã lưu. Bài đã nộp được chấm lại nếu thang điểm đổi.' } : { ok: false, text: res.error });
    });
  };

  return (
    <section className="grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
      <h2 className="font-semibold">Thông tin đề · <span className="num font-normal text-muted">{count} câu</span></h2>
      {msg && <Alert tone={msg.ok ? 'ok' : 'pen'}>{msg.text}</Alert>}
      <Field label="Tên đề" htmlFor="exam-title" error={errs.title}>
        <Input
          id="exam-title"
          value={title}
          maxLength={200}
          invalid={!!errs.title}
          onChange={(e) => {
            const v = e.target.value;
            setTitle(v);
            if (errs.title) setErrs((p) => ({ ...p, title: validateTitle(v, 'tên đề') }));
          }}
          onBlur={() => setErrs((p) => ({ ...p, title: validateTitle(title, 'tên đề') }))}
        />
      </Field>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Điểm mỗi câu theo dạng</legend>
        {([['mcq', 'Trắc nghiệm'], ['tf', 'Đúng/Sai (4 ý đúng)'], ['short', 'Trả lời ngắn']] as const).map(([k, label]) => (
          <div key={k} className="grid gap-1">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className={cx(errs[k] && 'font-medium text-pen')}>{label}</span>
              <Input
                value={s[k]}
                invalid={!!errs[k]}
                onChange={(e) => {
                  const v = e.target.value;
                  setS({ ...s, [k]: v });
                  if (errs[k]) setErrs((p) => ({ ...p, [k]: validatePointValue(v, false) }));
                }}
                onBlur={() => setErrs((p) => ({ ...p, [k]: validatePointValue(s[k], false) }))}
                inputMode="decimal"
                className="max-w-[6rem] text-right"
                aria-label={`Điểm ${label}`}
              />
            </label>
            <FieldError error={errs[k]} />
          </div>
        ))}
        <label className="mt-1 flex min-h-10 items-center gap-2.5 text-sm">
          <input type="checkbox" checked={s.scale10} onChange={(e) => setS({ ...s, scale10: e.target.checked })} className="h-5 w-5 shrink-0 accent-[rgb(var(--brand))]" />
          Quy về thang 10
        </label>
      </fieldset>
      <Button variant="secondary" onClick={save} disabled={pending}>Lưu thông tin</Button>
      <div className="border-t border-line pt-3">
        {status === 'draft' ? (
          <Button className="w-full" onClick={() => start(async () => { await setExamStatus(id, 'published'); })} disabled={pending}>Xuất bản đề</Button>
        ) : (
          <Button variant="secondary" className="w-full" onClick={() => start(async () => { await setExamStatus(id, 'draft'); })} disabled={pending}>Chuyển về nháp</Button>
        )}
      </div>
      {!confirmDel ? (
        <button type="button" onClick={() => setConfirmDel(true)} className="min-h-10 justify-self-start text-sm font-medium text-pen hover:underline">Xoá đề…</button>
      ) : (
        <div className="grid gap-2 rounded-lg bg-pen-soft p-3 text-sm text-pen">
          Xoá hẳn đề này cùng file gốc? Không hoàn tác được.
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => start(async () => { const r = await deleteExam(id); if (r && !r.ok) setMsg({ ok: false, text: r.error }); setConfirmDel(false); })} disabled={pending}>Xoá đề</Button>
            <Button variant="secondary" onClick={() => setConfirmDel(false)}>Không</Button>
          </div>
        </div>
      )}
    </section>
  );
}
