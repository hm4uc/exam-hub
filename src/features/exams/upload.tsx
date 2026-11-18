'use client';
import { FileUp, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { AnswerPicker } from './answer-picker';
import { Rich } from './rich';
import { Alert, Badge, Button, Field, Input, cx } from '@/components/ui';
import type { DocxParse } from '@/domain/exam/docx';
import { normNum, normTF } from '@/domain/exam/parse';
import { IMAGE_BUCKET } from '@/domain/exam/question-io';
import { TYPE_NAME, type ParsedQuestion, type QuestionInput } from '@/domain/exam/types';
import { supabaseBrowser } from '@/server/supabase/client';
import { createExam } from './actions';

interface Item { q: ParsedQuestion; include: boolean; answer: string | string[] | undefined }

// Lỗi có thể sửa bằng cách chọn lại đáp án ngay tại đây; các lỗi khác cần sửa file Word hoặc bỏ câu.
const isAnswerError = (e: string) => /đáp án|gạch chân/i.test(e);
const validAnswer = (q: ParsedQuestion, a: Item['answer']) =>
  q.type === 'mcq' ? typeof a === 'string' && q.options.some((o) => o.label === a)
  : q.type === 'tf' ? typeof a === 'string' && !!normTF(a)
  : Array.isArray(a) && a.length > 0 && a.every((x) => normNum(x) !== null);

export function UploadClient() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<DocxParse | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState<'' | 'parse' | 'save'>('');
  const [err, setErr] = useState('');
  const [drag, setDrag] = useState(false);

  const imgUrls = useMemo(() => {
    const m = new Map<string, string>();
    for (const im of parsed?.images ?? []) if (im.displayable) m.set(im.rId, URL.createObjectURL(new Blob([im.data as BlobPart], { type: im.ext === 'svg' ? 'image/svg+xml' : `image/${im.ext === 'jpg' ? 'jpeg' : im.ext}` })));
    return m;
  }, [parsed]);
  const imageUrl = useCallback((ref: string) => imgUrls.get(ref) ?? null, [imgUrls]);

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (!/\.docx$/i.test(f.name)) { setErr('Chỉ nhận file Word .docx. File .doc cũ hãy mở bằng Word rồi "Lưu thành" .docx.'); return; }
    setErr(''); setBusy('parse'); setFile(f);
    try {
      const { parseDocx } = await import('@/domain/exam/docx');
      const res = await parseDocx(await f.arrayBuffer());
      setParsed(res);
      setItems(res.questions.map((q) => ({ q, include: true, answer: q.answer })));
      setTitle(f.name.replace(/\.docx$/i, '').replace(/[_]+/g, ' ').trim());
    } catch (e) {
      setParsed(null); setItems([]);
      setErr((e as Error).message || 'Không đọc được file.');
    } finally { setBusy(''); }
  }

  const status = items.map((it) => {
    const blocking = it.q.errors.filter((e) => !isAnswerError(e));
    const ok = !it.include || (blocking.length === 0 && validAnswer(it.q, it.answer));
    return { blocking, ok };
  });
  const included = items.filter((i) => i.include).length;
  const problems = status.filter((s) => !s.ok).length;
  const canSave = !!parsed && included > 0 && problems === 0 && title.trim() !== '' && !busy;

  async function save() {
    if (!parsed || !file) return;
    setBusy('save'); setErr('');
    try {
      const supabase = supabaseBrowser();
      const examKey = crypto.randomUUID();
      const keep = items.filter((i) => i.include);
      // Ảnh được dùng trong các câu giữ lại → Storage
      const used = new Set<string>();
      for (const { q } of keep) for (const s of [q.stem, q.solution ?? '', ...q.options.map((o) => o.text), ...q.statements.map((o) => o.text)])
        for (const m of s.matchAll(/⟦img:([^⟧]+)⟧/g)) used.add(m[1]);
      const pathOf = new Map<string, string>();
      for (const im of parsed.images.filter((x) => x.displayable && used.has(x.rId))) {
        const path = `${examKey}/${im.rId}.${im.ext}`;
        const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, new Blob([im.data as BlobPart]), { contentType: `image/${im.ext === 'jpg' ? 'jpeg' : im.ext}`, upsert: true });
        if (error) throw new Error('Chưa tải được ảnh trong đề lên. Hãy thử lại.');
        pathOf.set(im.rId, path);
      }
      const sourcePath = `${examKey}/${file.name.replace(/[^\w.\-]+/g, '_')}`;
      await supabase.storage.from('exam-files').upload(sourcePath, file, { upsert: true });
      const fix = (s: string) => s.replace(/⟦img:([^⟧]+)⟧/g, (m, id) => (pathOf.has(id) ? `⟦img:${pathOf.get(id)}⟧` : m));
      const questions: QuestionInput[] = keep.map(({ q, answer }, i) => ({
        position: i + 1,
        part: q.part,
        type: q.type,
        stem: fix(q.stem),
        choices: (q.type === 'mcq' ? q.options : q.statements).map((c) => ({ label: c.label, text: fix(c.text) })),
        answer: answer!,
        solution: q.solution ? fix(q.solution) : null,
        points: null,
      }));
      const res = await createExam({ title: title.trim(), sourcePath, questions });
      if (!res.ok) throw new Error(res.error);
      router.push(`/gv/de/${res.id}`);
    } catch (e) {
      setErr((e as Error).message || 'Chưa lưu được đề.');
      setBusy('');
    }
  }

  return (
    <div className="grid gap-5">
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]); }}
        className={cx('flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors', drag ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-brand/60')}>
        {busy === 'parse' ? <Loader2 className="h-7 w-7 animate-spin text-brand" aria-hidden /> : <FileUp className="h-7 w-7 text-brand" aria-hidden />}
        <span className="font-semibold">{file ? file.name : 'Chọn hoặc kéo thả file đề (.docx)'}</span>
        <span className="text-sm text-muted">File được đọc ngay trên máy của bạn. {file && 'Bấm để chọn file khác.'}</span>
        <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>

      {err && <Alert>{err}</Alert>}

      {parsed && (
        <>
          {parsed.errors.map((e) => <Alert key={e}>{e}</Alert>)}
          <div className="grid gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Tên đề" htmlFor="title"><Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} /></Field>
            <Button onClick={save} disabled={!canSave}>{busy === 'save' ? 'Đang lưu…' : `Lưu đề (${included} câu)`}</Button>
            <div className="flex flex-wrap gap-2 text-sm sm:col-span-2">
              <Badge>{items.length} câu tìm thấy</Badge>
              {(['mcq', 'tf', 'short'] as const).map((t) => { const n = items.filter((i) => i.q.type === t).length; return n ? <Badge key={t}>{TYPE_NAME[t]}: {n}</Badge> : null; })}
              {problems ? <Badge tone="pen">{problems} câu cần xử lý</Badge> : <Badge tone="ok">Sẵn sàng lưu</Badge>}
              {parsed.stats.omml > 0 && <Badge tone="brand">{parsed.stats.omml} công thức Equation</Badge>}
            </div>
          </div>

          <ol className="grid gap-3">
            {items.map((it, i) => {
              const { q } = it, st = status[i];
              const choices = q.type === 'mcq' ? q.options : q.statements;
              return (
                <li key={i} className={cx('rounded-xl border bg-surface p-4', !it.include ? 'border-line opacity-60' : st.ok ? 'border-line' : 'border-pen')}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <b>Câu {q.n}</b><Badge tone="brand">{TYPE_NAME[q.type]}</Badge>{q.part && <span className="text-xs text-muted">Phần {q.part}</span>}
                    <label className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted">
                      <input type="checkbox" checked={!it.include} onChange={(e) => setItems((xs) => xs.map((x, k) => (k === i ? { ...x, include: !e.target.checked } : x)))} className="h-5 w-5 shrink-0 accent-[rgb(var(--pen))]" />
                      Bỏ câu này
                    </label>
                  </div>
                  {it.include && st.blocking.map((e) => <Alert key={e} className="mb-2">{e}</Alert>)}
                  {it.include && q.errors.filter(isAnswerError).length > 0 && (
                    <Alert tone={validAnswer(q, it.answer) ? 'ok' : 'pen'} className="mb-2">
                      {q.errors.filter(isAnswerError).join(' ')} {validAnswer(q, it.answer) ? 'Đã chọn đáp án bên dưới.' : 'Chọn đáp án đúng bên dưới.'}
                    </Alert>
                  )}
                  {q.warnings.map((w) => <Alert key={w} tone="warn" className="mb-2">{w}</Alert>)}
                  <Rich src={q.stem} imageUrl={imageUrl} />
                  {q.type !== 'short' && (
                    <ul className="mt-2 grid gap-1">
                      {choices.map((c) => {
                        const correct = q.type === 'mcq' ? it.answer === c.label : typeof it.answer === 'string' && it.answer[choices.indexOf(c)] === 'Đ';
                        return (
                          <li key={c.label} className={cx('flex gap-2 rounded-lg px-2 py-1', correct && 'bg-ok-soft')}>
                            <b className="shrink-0">{c.label}{q.type === 'mcq' ? '.' : ')'}</b><Rich src={c.text} imageUrl={imageUrl} className="min-w-0 flex-1" />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
                    <span className="text-sm text-muted">Đáp án:</span>
                    <AnswerPicker type={q.type} labels={choices.map((c) => c.label)} value={it.answer} idPrefix={`q${i}`}
                      onChange={(v) => setItems((xs) => xs.map((x, k) => (k === i ? { ...x, answer: v } : x)))} />
                    {Object.keys(q.sources).length > 0 && (
                      <span className="text-xs text-muted">Lấy từ: {Object.entries(q.sources).map(([k, v]) => `${k} (${v})`).join(', ')}</span>
                    )}
                  </div>
                  {q.solution && (
                    <details className="mt-2 text-sm"><summary className="cursor-pointer py-2.5 font-medium text-brand">Lời giải</summary><Rich src={q.solution} imageUrl={imageUrl} className="mt-1 text-muted" /></details>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
