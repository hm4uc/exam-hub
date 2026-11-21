import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, ButtonLink } from '@/components/ui';
import type { PerQuestionScore, ReviewQuestionInput } from '@/domain/exam/review';
import { GuestCookieSync } from '@/features/attempt/guest-cookie-sync';
import { AttemptReview } from '@/features/review/attempt-review';
import { fmtDateTime, fmtNum, fmtScore, isCode } from '@/lib/format';
import { rpcMessage } from '@/lib/rpc-messages';
import { getMe } from '@/server/auth';
import { supabaseServer } from '@/server/supabase/server';

export const metadata: Metadata = { title: 'Kết quả' };

interface Result {
  attempt_id: string;
  title: string;
  code: string;
  submitted_at: string;
  tab_leaves: number;
  result_mode: 'none' | 'score' | 'score_answers';
  visible: boolean;
  release_at: string | null;
  guest_name?: string | null;
  is_guest?: boolean;
  score?: number;
  score_raw?: number;
  score_max?: number;
  per_question?: Record<string, PerQuestionScore>;
  answers?: Record<string, string>;
  questions?: ReviewQuestionInput[];
}

export default async function ResultPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ id?: string }> }) {
  const { code } = await params;
  const { id } = await searchParams;
  const normalized = code.toLowerCase();
  if (!isCode(normalized) || !id || !/^[0-9a-f-]{36}$/.test(id)) notFound();

  const me = await getMe();
  const guestCookie = (await cookies()).get('eh_guest')?.value ?? null;
  const isGuest = !me;

  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc('attempt_result', {
    p_attempt: id,
    p_guest_key: isGuest ? guestCookie : null,
  });

  if (error) {
    return (
      <main id="main-content" className="page-enter mx-auto max-w-xl px-4 py-8">
        {isGuest && <GuestCookieSync hasCookie={!!guestCookie} />}
        <Alert>{rpcMessage(error)}</Alert>
        <Link href={`/${normalized}`} className="mt-4 inline-block text-sm font-semibold text-brand underline">Về trang bài kiểm tra</Link>
      </main>
    );
  }
  const r = data as Result;
  const backHref = isGuest ? `/${normalized}` : '/';
  const backLabel = isGuest ? 'Về trang bài kiểm tra' : 'Bài của tôi';

  return (
    <main id="main-content" className="page-enter mx-auto max-w-3xl px-4 py-6">
      <Link href={backHref} className="-my-1 inline-flex min-h-10 items-center gap-1 text-sm text-muted transition-colors hover:text-brand">
        <ArrowLeft className="h-4 w-4" aria-hidden />{backLabel}
      </Link>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">{r.title}</h1>
      <p className="mb-5 mt-1 text-sm text-muted">
        {r.guest_name ? <><b className="text-ink">{r.guest_name}</b> · </> : null}
        Đã nộp lúc {fmtDateTime(r.submitted_at)}
      </p>

      {r.visible && r.questions && r.per_question ? (
        <AttemptReview
          viewer="student"
          score={r.score ?? null}
          scoreRaw={r.score_raw ?? null}
          scoreMax={r.score_max ?? null}
          submittedAt={r.submitted_at}
          questions={r.questions}
          answers={r.answers ?? {}}
          perQuestion={r.per_question}
        />
      ) : (
        <section className="rounded-xl border border-line bg-surface p-5 shadow-card">
          {!r.visible ? (
            <>
              <p className="text-lg font-bold text-ok">Đã nộp bài thành công</p>
              <p className="mt-1 text-sm text-muted">
                {r.result_mode === 'none'
                  ? 'Thầy cô sẽ thông báo điểm sau.'
                  : r.release_at
                    ? `Điểm sẽ hiện sau khi bài đóng (${fmtDateTime(r.release_at)}).`
                    : 'Điểm sẽ hiện sau khi thầy cô đóng bài.'}
              </p>
            </>
          ) : (
            <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
              <p className="grade-mark grade-stamp num text-6xl leading-none">{fmtScore(r.score)}</p>
              <p className="pb-1 text-sm text-muted">
                điểm (thang 10)<br />
                <span className="num">Đạt {fmtNum(r.score_raw)} / {fmtNum(r.score_max)} điểm câu hỏi</span>
              </p>
            </div>
          )}
        </section>
      )}

      <ButtonLink href={backHref} variant="secondary" className="mt-6">{backLabel}</ButtonLink>
    </main>
  );
}
