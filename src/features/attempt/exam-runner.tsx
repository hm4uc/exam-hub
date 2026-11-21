'use client';
import { Check, ChevronLeft, ChevronRight, CloudOff, Flag, Loader2, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, cx } from '@/components/ui';
import { ExamRunnerSkeleton } from '@/components/skeletons';
import { ensureGuestKey, getSavedGuestName } from '@/lib/guest';
import { RPC_MESSAGES } from '@/lib/rpc-messages';
import { traceClient } from '@/lib/trace-client';
import { supabaseBrowser } from '@/server/supabase/client';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/server/supabase/env';

type QType = 'mcq' | 'tf' | 'short';
interface Q { id: string; type: QType; stem_html: string; choices: { label: string; html: string }[] }
interface Start {
  attempt_id: string;
  title: string;
  deadline_at: string;
  server_now: string;
  answers: Record<string, string>;
  tab_leaves: number;
  guest_name?: string | null;
  questions: Q[];
}
type SaveState = 'saved' | 'saving' | 'offline';

const TYPE_NAME: Record<QType, string> = { mcq: 'Trắc nghiệm', tf: 'Đúng/Sai', short: 'Trả lời ngắn' };
const LETTERS = 'ABCD';
const isAnswered = (q: Q, v: string | undefined) =>
  !!v && (q.type === 'tf' ? v.length === 4 && !v.includes('_') : v.trim() !== '');

const draftKey = (id: string) => `eh:attempt:${id}`;
function readDraft(id: string): { pending: Record<string, string>; leaves: number } | null {
  try { return JSON.parse(localStorage.getItem(draftKey(id)) ?? 'null'); } catch { return null; }
}
function writeDraft(id: string, d: { pending: Record<string, string>; leaves: number }) {
  try { localStorage.setItem(draftKey(id), JSON.stringify(d)); } catch { /* bộ nhớ bị chặn: vẫn còn bản trên server */ }
}
function clearDraft(id: string) { try { localStorage.removeItem(draftKey(id)); } catch { /* bỏ qua */ } }

export function ExamRunner({ code }: { code: string }) {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [data, setData] = useState<Start | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [cur, setCur] = useState(0);
  const [dir, setDir] = useState<'next' | 'prev'>('next');
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [save, setSave] = useState<SaveState>('saved');
  const [left, setLeft] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState('');

  const pending = useRef<Record<string, string>>({});
  const leaves = useRef(0);
  const sentLeaves = useRef(0);
  const offset = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef(false);
  const done = useRef(false);
  const token = useRef<string>('');
  const guestKey = useRef<string | null>(null);
  const wasOffline = useRef(false);
  // Ngữ cảnh hiện tại cho trace khi có lỗi hoặc thoát trang
  const ctxRef = useRef({ cur: 0, doneCount: 0, total: 0, save: 'saved' as SaveState });
  const flushRef = useRef<(keepalive?: boolean) => Promise<void>>(async () => {});

  const goResult = useCallback((id: string) => {
    done.current = true;
    clearDraft(id);
    router.replace(`/${code}/ket-qua?id=${id}`);
  }, [code, router]);

  // ---------------- tải đề
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      token.current = s.session?.access_token ?? '';
      if (!token.current) {
        guestKey.current = ensureGuestKey().key;
      } else {
        guestKey.current = null;
      }
      const t0 = Date.now();
      const { data: res, error } = await supabase.rpc('start_attempt', {
        p_code: code,
        p_password: null,
        p_guest_key: token.current ? null : guestKey.current,
        p_guest_name: token.current ? null : (getSavedGuestName() || null),
      });
      if (!alive) return;
      if (error) {
        traceClient({
          level: 'warn',
          category: 'exam',
          event: 'attempt_start_failed',
          assignment_code: code,
          message: error.message,
          meta: { on_take_page: true, is_guest: !token.current },
          urgent: true,
        });
        if (error.message === 'WRONG_PASSWORD' || error.message === 'LOGIN_REQUIRED') {
          router.replace(`/${code}`);
          return;
        }
        setLoadErr(RPC_MESSAGES[error.message] ?? 'Chưa mở được đề. Hãy tải lại trang.');
        return;
      }
      const st = res as Start;
      offset.current = new Date(st.server_now).getTime() - (t0 + Date.now()) / 2;
      const draft = readDraft(st.attempt_id);
      const merged = { ...st.answers, ...(draft?.pending ?? {}) };
      pending.current = { ...(draft?.pending ?? {}) };
      leaves.current = Math.max(st.tab_leaves, draft?.leaves ?? 0);
      sentLeaves.current = st.tab_leaves;
      setAnswers(merged);
      setData(st);
      traceClient({
        category: 'exam',
        event: 'attempt_loaded',
        attempt_id: st.attempt_id,
        assignment_code: code,
        message: `Mở đề (${st.questions.length} câu, đã có ${Object.keys(merged).length} câu)`,
        meta: {
          is_guest: !token.current,
          guest_name: st.guest_name ?? null,
          server_answers: Object.keys(st.answers).length,
          local_draft: Object.keys(draft?.pending ?? {}).length,
          tab_leaves: leaves.current,
        },
      });
    })();
    return () => { alive = false; };
  }, [code, router, supabase]);

  // ---------------- lưu
  const flush = useCallback(async (keepalive = false) => {
    if (!data || done.current) return;
    const patch = pending.current;
    if (!Object.keys(patch).length && leaves.current === sentLeaves.current) { setSave('saved'); return; }
    if (inflight.current && !keepalive) return;
    inflight.current = true;
    pending.current = {};
    const lv = leaves.current;
    setSave('saving');
    try {
      const { data: s } = await supabase.auth.getSession();
      if (s.session?.access_token) token.current = s.session.access_token;
      const authBearer = token.current || SUPABASE_ANON_KEY;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/save_answers`, {
        method: 'POST',
        keepalive,
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${authBearer}` },
        body: JSON.stringify({
          p_attempt: data.attempt_id,
          p_answers: patch,
          p_tab_leaves: lv,
          p_guest_key: token.current ? null : guestKey.current,
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        if (body?.message === 'TIME_UP' || body?.message === 'ALREADY_SUBMITTED') {
          traceClient({
            level: 'info',
            category: 'exam',
            event: 'attempt_forced_result',
            attempt_id: data.attempt_id,
            assignment_code: code,
            message: body.message,
            meta: { current_question: ctxRef.current.cur + 1, answered: ctxRef.current.doneCount },
            urgent: true,
          });
          goResult(data.attempt_id);
          return;
        }
        throw new Error(`${r.status}: ${body?.message ?? 'HTTP_ERROR'}`);
      }
      sentLeaves.current = lv;
      writeDraft(data.attempt_id, { pending: pending.current, leaves: leaves.current });
      setSave(Object.keys(pending.current).length ? 'saving' : 'saved');
      if (wasOffline.current) {
        wasOffline.current = false;
        traceClient({
          level: 'info',
          category: 'network',
          event: 'save_answers_recovered',
          attempt_id: data.attempt_id,
          assignment_code: code,
          message: `Đã lưu lại thành công (Câu ${ctxRef.current.cur + 1})`,
          meta: { current_question: ctxRef.current.cur + 1, answered: ctxRef.current.doneCount },
        });
      }
    } catch (err) {
      pending.current = { ...patch, ...pending.current };
      writeDraft(data.attempt_id, { pending: pending.current, leaves: leaves.current });
      setSave('offline');
      wasOffline.current = true;
      traceClient({
        level: 'warn',
        category: 'exam',
        event: 'save_answers_failed',
        attempt_id: data.attempt_id,
        assignment_code: code,
        message: err instanceof Error ? err.message : 'Network error',
        meta: {
          current_question: ctxRef.current.cur + 1,
          answered: ctxRef.current.doneCount,
          pending_keys: Object.keys(pending.current).length,
          online: typeof navigator !== 'undefined' ? navigator.onLine : null,
          is_guest: !token.current,
        },
      });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => flushRef.current(), 4000);
    } finally {
      inflight.current = false;
    }
    if (Object.keys(pending.current).length) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => flushRef.current(), 800);
    }
  }, [code, data, goResult, supabase]);
  useEffect(() => { flushRef.current = flush; }, [flush]);

  const setAnswer = useCallback((qid: string, v: string) => {
    if (!data) return;
    setAnswers((a) => ({ ...a, [qid]: v }));
    pending.current[qid] = v;
    writeDraft(data.attempt_id, { pending: pending.current, leaves: leaves.current });
    setSave('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flush(), 800);
  }, [data, flush]);

  // gửi bản nháp còn sót lại từ lần trước (mất mạng / tắt app)
  useEffect(() => { if (data && Object.keys(pending.current).length) flush(); }, [data, flush]);

  // ---------------- rời tab + cảnh báo thoát nhầm + lưu & trace khi rời trang
  useEffect(() => {
    if (!data) return;
    let blurTimer: ReturnType<typeof setTimeout> | null = null;
    let lastTraceLeave = 0;
    const bump = (kind: 'tab_hidden' | 'window_blur') => {
      leaves.current += 1;
      writeDraft(data.attempt_id, { pending: pending.current, leaves: leaves.current });
      const now = Date.now();
      if (now - lastTraceLeave > 15000) {
        lastTraceLeave = now;
        traceClient({
          level: 'info',
          category: 'exam',
          event: kind,
          attempt_id: data.attempt_id,
          assignment_code: code,
          message: `Rời trang lần ${leaves.current} tại Câu ${ctxRef.current.cur + 1}`,
          meta: { current_question: ctxRef.current.cur + 1, answered: ctxRef.current.doneCount, total: ctxRef.current.total, tab_leaves: leaves.current },
        });
      }
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        if (blurTimer) { clearTimeout(blurTimer); blurTimer = null; }
        bump('tab_hidden');
        flush(true);
      }
    };
    const onBlur = () => {
      blurTimer = setTimeout(() => {
        blurTimer = null;
        if (document.visibilityState === 'visible' && !document.hasFocus()) bump('window_blur');
      }, 400);
    };
    const onHide = (e: PageTransitionEvent) => {
      flush(true);
      if (!done.current) {
        traceClient({
          level: 'warn',
          category: 'exam',
          event: 'exam_exit_pagehide',
          attempt_id: data.attempt_id,
          assignment_code: code,
          message: `Rời trang làm bài khi đang ở Câu ${ctxRef.current.cur + 1} (đã làm ${ctxRef.current.doneCount}/${ctxRef.current.total})`,
          meta: {
            current_question: ctxRef.current.cur + 1,
            answered: ctxRef.current.doneCount,
            total: ctxRef.current.total,
            save_state: ctxRef.current.save,
            tab_leaves: leaves.current,
            persisted: e.persisted,
            online: navigator.onLine,
          },
          urgent: true,
        });
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (done.current) return;
      flush(true);
      e.preventDefault();
      e.returnValue = '';
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (blurTimer) clearTimeout(blurTimer);
    };
  }, [code, data, flush]);

  // ---------------- nộp
  const submit = useCallback(async (auto = false) => {
    if (!data || submitting) return;
    setSubmitting(true);
    setSubmitErr('');
    traceClient({
      category: 'exam',
      event: auto ? 'attempt_auto_submit' : 'attempt_submit_start',
      attempt_id: data.attempt_id,
      assignment_code: code,
      message: `${auto ? 'Hết giờ tự nộp' : 'Nộp bài'} (${ctxRef.current.doneCount}/${ctxRef.current.total} câu)`,
      meta: { current_question: ctxRef.current.cur + 1, answered: ctxRef.current.doneCount, total: ctxRef.current.total },
    });
    await flush();
    const { error } = await supabase.rpc('submit_attempt', {
      p_attempt: data.attempt_id,
      p_guest_key: token.current ? null : guestKey.current,
    });
    if (error && error.message !== 'ALREADY_SUBMITTED') {
      traceClient({
        level: 'error',
        category: 'exam',
        event: 'attempt_submit_failed',
        attempt_id: data.attempt_id,
        assignment_code: code,
        message: error.message,
        meta: { current_question: ctxRef.current.cur + 1, answered: ctxRef.current.doneCount },
        urgent: true,
      });
      setSubmitting(false);
      setSubmitErr(error.message in RPC_MESSAGES ? RPC_MESSAGES[error.message] : 'Chưa nộp được, có thể do mất mạng. Bài làm vẫn được lưu; hãy bấm nộp lại.');
      return;
    }
    traceClient({
      category: 'exam',
      event: 'attempt_submit_ok',
      attempt_id: data.attempt_id,
      assignment_code: code,
      message: `Nộp bài thành công (${ctxRef.current.doneCount}/${ctxRef.current.total} câu)`,
      urgent: true,
    });
    goResult(data.attempt_id);
  }, [code, data, flush, goResult, submitting, supabase]);

  // ---------------- đồng hồ (theo giờ server)
  useEffect(() => {
    if (!data) return;
    const deadline = new Date(data.deadline_at).getTime();
    const tick = () => {
      const ms = Math.max(0, deadline - (Date.now() + offset.current));
      setLeft(ms);
      if (ms === 0 && !done.current) submit(true);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [data, submit]);

  const qs = useMemo(() => data?.questions ?? [], [data]);
  const q = qs[cur];
  const doneCount = useMemo(() => qs.filter((x) => isAnswered(x, answers[x.id])).length, [qs, answers]);

  useEffect(() => {
    ctxRef.current = { cur, doneCount, total: qs.length, save };
  }, [cur, doneCount, qs.length, save]);

  const exitTemporarily = async () => {
    if (!data) return;
    await flush();
    done.current = true;
    traceClient({
      level: 'info',
      category: 'exam',
      event: 'exam_exit_confirm',
      attempt_id: data.attempt_id,
      assignment_code: code,
      message: `Học sinh bấm thoát tạm tại Câu ${cur + 1} (đã làm ${doneCount}/${qs.length})`,
      urgent: true,
    });
    router.push(`/${code}`);
  };

  const goTo = useCallback((nextIdx: number) => {
    setCur((prev) => {
      setDir(nextIdx >= prev ? 'next' : 'prev');
      return nextIdx;
    });
    setConfirming(false);
  }, []);

  if (loadErr) return (
    <main id="main-content" className="page-enter mx-auto max-w-xl px-4 py-8">
      <Alert>{loadErr}</Alert>
      <Link href={`/${code}`} className="mt-4 inline-block text-sm font-semibold text-brand underline">Quay lại</Link>
    </main>
  );
  if (!data || !q) return <ExamRunnerSkeleton />;

  const mm = Math.floor((left ?? 0) / 60000), ss = Math.floor(((left ?? 0) % 60000) / 1000);
  const low = (left ?? 1e9) < 5 * 60000;
  const unanswered = qs.length - doneCount;

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{data.title}</p>
            {data.guest_name && <p className="truncate text-xs text-muted">{data.guest_name}</p>}
          </div>
          <SaveBadge state={save} />
          <span className={cx('num rounded-lg px-2.5 py-1 text-lg font-bold tabular-nums', low ? 'bg-pen-soft text-pen' : 'bg-sunken')} aria-live="off" aria-label={`Còn ${mm} phút ${ss} giây`}>
            {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
          </span>
          <button
            type="button"
            onClick={() => setConfirmExit((v) => !v)}
            title="Thoát tạm khỏi phòng thi"
            aria-label="Thoát tạm"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink"
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {confirmExit && (
          <div className="border-t border-line bg-warn-soft px-4 py-2.5 text-sm">
            <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2">
              <p className="text-warn">Thoát tạm khỏi màn làm bài? Bài đã lưu, đồng hồ vẫn chạy và bạn vào làm tiếp được.</p>
              <div className="flex gap-2">
                <Button variant="secondary" className="min-h-8 px-3 py-1 text-xs" onClick={exitTemporarily}>Thoát tạm</Button>
                <Button className="min-h-8 px-3 py-1 text-xs" onClick={() => setConfirmExit(false)}>Ở lại làm tiếp</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <main id="main-content" className="mx-auto grid max-w-3xl gap-4 px-4 pt-4">
        <section aria-label="Phiếu trả lời" className="rounded-xl border border-line bg-surface p-3 sm:p-4">
          <div className="mb-2.5 flex items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold">Phiếu trả lời</span>
            <span className="num text-muted">Đã làm {doneCount}/{qs.length}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {qs.map((x, i) => (
              <button key={x.id} type="button" className="bubble" onClick={() => goTo(i)}
                data-state={isAnswered(x, answers[x.id]) ? 'filled' : 'empty'} data-current={i === cur} data-flag={!!flags[x.id]}
                aria-label={`Câu ${i + 1}${isAnswered(x, answers[x.id]) ? ', đã làm' : ''}${flags[x.id] ? ', đánh dấu xem lại' : ''}`} aria-current={i === cur ? 'step' : undefined}>
                {i + 1}
              </button>
            ))}
          </div>
        </section>

        <article key={q.id} className={cx('rounded-xl border border-line bg-surface p-4 shadow-card sm:p-6', dir === 'next' ? 'q-enter-next' : 'q-enter-prev')} aria-labelledby="qtitle">
          <div className="mb-3 flex items-center gap-2">
            <h2 id="qtitle" className="text-base font-bold">Câu {cur + 1}</h2>
            <span className="text-sm text-muted">· {TYPE_NAME[q.type]}</span>
            <button type="button" onClick={() => setFlags((f) => ({ ...f, [q.id]: !f[q.id] }))}
              className={cx('-my-1.5 ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium', flags[q.id] ? 'bg-warn-soft text-warn' : 'text-muted hover:bg-sunken')} aria-pressed={!!flags[q.id]}>
              <Flag className="h-4 w-4" aria-hidden /> {flags[q.id] ? 'Đã đánh dấu' : 'Xem lại sau'}
            </button>
          </div>
          <div className="rich text-[1.0625rem]" dangerouslySetInnerHTML={{ __html: q.stem_html }} />

          {q.type === 'mcq' && (
            <div role="radiogroup" aria-labelledby="qtitle" className="mt-4 grid gap-2">
              {q.choices.map((c, i) => {
                const sel = answers[q.id] === c.label;
                return (
                  <button key={c.label} type="button" role="radio" aria-checked={sel} onClick={() => setAnswer(q.id, c.label)}
                    className={cx('flex min-h-12 items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors', sel ? 'border-brand bg-brand-soft' : 'border-line hover:bg-sunken')}>
                    <span className="bubble h-8 w-8 shrink-0" data-state={sel ? 'filled' : 'empty'}>{LETTERS[i]}</span>
                    <span className="rich min-w-0 flex-1 pt-1" dangerouslySetInnerHTML={{ __html: c.html }} />
                  </button>
                );
              })}
            </div>
          )}

          {q.type === 'tf' && (
            <div className="mt-4 divide-y divide-line">
              {q.choices.map((c, j) => {
                const v = (answers[q.id] ?? '____').padEnd(4, '_')[j];
                const pick = (val: 'Đ' | 'S') => {
                  const arr = (answers[q.id] ?? '____').padEnd(4, '_').split('');
                  arr[j] = val;
                  setAnswer(q.id, arr.join(''));
                };
                return (
                  <div key={c.label} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                    <div className="min-w-0 flex-1 basis-56"><b className="mr-1">{c.label})</b><span className="rich" dangerouslySetInnerHTML={{ __html: c.html }} /></div>
                    <div className="inline-flex overflow-hidden rounded-lg border border-line" role="group" aria-label={`Ý ${c.label}`}>
                      <button type="button" aria-pressed={v === 'Đ'} onClick={() => pick('Đ')} className={cx('min-h-10 px-4 text-sm font-semibold', v === 'Đ' ? 'bg-ok text-surface' : 'bg-surface text-muted hover:bg-sunken')}>Đúng</button>
                      <button type="button" aria-pressed={v === 'S'} onClick={() => pick('S')} className={cx('min-h-10 border-l border-line px-4 text-sm font-semibold', v === 'S' ? 'bg-pen text-surface' : 'bg-surface text-muted hover:bg-sunken')}>Sai</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {q.type === 'short' && (
            <div className="mt-4">
              <label htmlFor={`sa-${q.id}`} className="text-sm text-muted">Đáp số (dùng dấu phẩy hoặc dấu chấm cho số thập phân)</label>
              <input id={`sa-${q.id}`} key={q.id} inputMode="decimal" autoComplete="off" maxLength={12} placeholder="Ví dụ: -2,5"
                value={answers[q.id] ?? ''} onChange={(e) => setAnswer(q.id, e.target.value.replace(/[^\d,.\-]/g, ''))}
                className="mt-1.5 block w-full max-w-[14rem] rounded-xl border border-line bg-surface px-4 py-3 text-xl font-semibold tabular-nums focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25" />
            </div>
          )}
        </article>

        {!confirming ? (
          <div className="flex items-center justify-between gap-3">
            <Button variant="secondary" onClick={() => goTo(cur - 1)} disabled={cur === 0}><ChevronLeft className="h-4 w-4" aria-hidden />Câu trước</Button>
            {cur < qs.length - 1 ? (
              <Button onClick={() => goTo(cur + 1)}>Câu sau<ChevronRight className="h-4 w-4" aria-hidden /></Button>
            ) : (
              <Button onClick={() => setConfirming(true)}>Nộp bài</Button>
            )}
          </div>
        ) : (
          <section className="rounded-xl border-2 border-brand bg-surface p-4" aria-live="polite">
            <p className="font-bold">Nộp bài?</p>
            <p className="mt-1 text-sm text-muted">
              {unanswered ? <>Còn <b className="text-pen">{unanswered}</b> câu chưa làm. </> : 'Bạn đã làm hết các câu. '}
              Sau khi nộp sẽ không sửa được nữa.
            </p>
            {submitErr && <Alert className="mt-3">{submitErr}</Alert>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => submit(false)} disabled={submitting}>{submitting ? 'Đang nộp…' : 'Nộp bài'}</Button>
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={submitting}>Làm tiếp</Button>
            </div>
          </section>
        )}
        {!confirming && cur < qs.length - 1 && (
          <button type="button" onClick={() => setConfirming(true)} className="min-h-11 justify-self-end px-1 text-sm font-semibold text-muted underline hover:text-brand">Nộp bài sớm</button>
        )}
      </main>
    </div>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  if (state === 'offline') return <span className="inline-flex items-center gap-1 text-xs font-semibold text-pen"><CloudOff className="h-4 w-4" aria-hidden />Mất mạng</span>;
  if (state === 'saving') return <span className="inline-flex items-center gap-1 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />Đang lưu</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-ok"><Check className="h-4 w-4" aria-hidden />Đã lưu</span>;
}
