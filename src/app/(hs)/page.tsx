import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Alert, Badge, Empty, interactiveRowClass } from '@/components/ui';
import { fmtDateTime, fmtScore } from '@/lib/format';
import { getMe, homePathFor, rpcMessage } from '@/server/auth';
import { supabaseServer } from '@/server/supabase/server';

export const metadata: Metadata = { title: 'Bài của tôi' };

interface Item {
  code: string; title: string; opens_at: string; closes_at: string | null; duration_minutes: number;
  state: 'open' | 'upcoming' | 'closed' | 'no_attempts_left' | 'in_progress'; best_score: number | null; last_attempt_id: string | null;
}

const STATE: Record<Item['state'], { label: string; tone: 'brand' | 'neutral' | 'ok' | 'warn' | 'pen' }> = {
  in_progress: { label: 'Đang làm dở', tone: 'warn' },
  open: { label: 'Đang mở', tone: 'brand' },
  upcoming: { label: 'Sắp mở', tone: 'neutral' },
  no_attempts_left: { label: 'Đã làm', tone: 'ok' },
  closed: { label: 'Đã đóng', tone: 'neutral' },
};

export default async function StudentHome() {
  const me = await getMe();
  if (!me) redirect('/dang-nhap');
  if (me.is_locked) redirect('/dang-nhap?locked=1');
  if (me.role !== 'student') redirect(homePathFor(me.role));

  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc('my_assignments');
  const res = data as { class_name: string | null; items: Item[] } | null;
  const items = res?.items ?? [];
  const groups = [
    { title: 'Cần làm', list: items.filter((i) => i.state === 'open' || i.state === 'in_progress') },
    { title: 'Sắp mở', list: items.filter((i) => i.state === 'upcoming') },
    { title: 'Đã xong', list: items.filter((i) => i.state === 'closed' || i.state === 'no_attempts_left') },
  ];

  return (
    <main id="main-content" className="page-enter mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Bài của tôi</h1>
      {error && <Alert className="mt-4">{rpcMessage(error)}</Alert>}
      {!res?.class_name && !items.length && !error && (
        <Alert tone="neutral" className="mt-4">Mở đường link bài kiểm tra thầy cô gửi để vào làm bài ngay. Các bài bạn làm sẽ lưu tại đây.</Alert>
      )}
      {res?.class_name && !items.length && (
        <div className="mt-6"><Empty title="Chưa có bài nào">Khi thầy cô giao bài cho lớp {res.class_name}, bài sẽ hiện ở đây.</Empty></div>
      )}
      {groups.filter((g) => g.list.length).map((g) => (
        <section key={g.title} className="mt-7">
          <h2 className="mb-3 text-base font-semibold">{g.title}</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            {g.list.map((i) => {
              const st = STATE[i.state];
              const href = (i.state === 'closed' || i.state === 'no_attempts_left') && i.last_attempt_id ? `/${i.code}/ket-qua?id=${i.last_attempt_id}` : `/${i.code}`;
              return (
                <li key={i.code}>
                  <Link href={href} className={interactiveRowClass}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold transition-colors group-hover:text-brand">{i.title}</p>
                      <p className="mt-0.5 text-sm text-muted">
                        {i.state === 'upcoming'
                          ? `Mở lúc ${fmtDateTime(i.opens_at)}`
                          : i.closes_at
                            ? `Hạn ${fmtDateTime(i.closes_at)}`
                            : 'Mở tự do'} · {i.duration_minutes} phút
                      </p>
                    </div>
                    {i.best_score != null ? (
                      <span className="grade-mark num text-xl">{fmtScore(i.best_score)}</span>
                    ) : (
                      <Badge tone={st.tone}>{st.label}</Badge>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted/60 transition-transform group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </main>
  );
}
