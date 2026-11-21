import type { Metadata } from 'next';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, PageTitle, Panel, StatStrip, cx } from '@/components/ui';
import { AssignmentControls, CopyLink, ExportButton, type ExportRow } from '@/features/assignments/results-controls';
import { fmtDateTime, fmtScore } from '@/lib/format';
import { supabaseServer } from '@/server/supabase/server';

export const metadata: Metadata = { title: 'Bài giao' };

interface Att {
  id: string;
  student_id: string | null;
  guest_name: string | null;
  guest_key: string | null;
  attempt_no: number;
  submitted_at: string | null;
  deadline_at: string;
  score: number | null;
  tab_leaves: number;
}

interface Participant {
  key: string;
  full_name: string;
  username: string;
  isGuest: boolean;
  outsider: boolean;
}

export default async function AssignmentResults({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await supabaseServer();
  const { data: a } = await supabase
    .from('assignments')
    .select('id, code, title, exam_id, class_id, restrict_to_class, opens_at, closes_at, duration_minutes, max_attempts, shuffle_questions, shuffle_choices, access_password, result_mode, result_release, exams(title), classes(name)')
    .eq('id', id)
    .maybeSingle();
  if (!a) notFound();

  const [{ data: students }, { data: attempts }, { data: classes }] = await Promise.all([
    a.class_id
      ? supabase.from('profiles').select('id, full_name, username').eq('class_id', a.class_id).eq('role', 'student').order('full_name')
      : Promise.resolve({ data: [] as { id: string; full_name: string; username: string }[] }),
    supabase
      .from('attempts')
      .select('id, student_id, guest_name, guest_key, attempt_no, submitted_at, deadline_at, score, tab_leaves')
      .eq('assignment_id', id)
      .order('attempt_no'),
    supabase.from('classes').select('id, name').is('archived_at', null).order('name'),
  ]);

  // Server Component: thời điểm hiện tại theo từng request
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const byActor = new Map<string, Att[]>();
  const loggedInStudentIds = new Set<string>();
  for (const t of (attempts ?? []) as Att[]) {
    const k = t.student_id ? `u:${t.student_id}` : `g:${t.guest_key ?? t.id}`;
    if (t.student_id) loggedInStudentIds.add(t.student_id);
    byActor.set(k, [...(byActor.get(k) ?? []), t]);
  }

  const classStudentSet = new Set((students ?? []).map((s) => s.id));
  const participants = new Map<string, Participant>();

  for (const s of students ?? []) {
    participants.set(`u:${s.id}`, { key: `u:${s.id}`, full_name: s.full_name, username: s.username, isGuest: false, outsider: false });
  }

  const extraIds = [...loggedInStudentIds].filter((sid) => !classStudentSet.has(sid));
  if (extraIds.length) {
    const { data: extra } = await supabase.from('profiles').select('id, full_name, username').in('id', extraIds);
    for (const s of extra ?? []) {
      participants.set(`u:${s.id}`, { key: `u:${s.id}`, full_name: s.full_name, username: s.username, isGuest: false, outsider: !!a.class_id });
    }
  }

  for (const [k, list] of byActor.entries()) {
    if (!k.startsWith('g:')) continue;
    const latestName = [...list].reverse().find((t) => t.guest_name)?.guest_name ?? 'Khách';
    participants.set(k, { key: k, full_name: latestName, username: 'Khách', isGuest: true, outsider: false });
  }

  const rows = [...participants.values()].map((p) => {
    const list = byActor.get(p.key) ?? [];
    const submitted = list.filter((t) => t.submitted_at);
    const live = list.find((t) => !t.submitted_at && new Date(t.deadline_at).getTime() + 30000 > now);
    const best = submitted.reduce<Att | null>((b, t) => (b == null || Number(t.score) > Number(b.score) ? t : b), null);
    const status: 'done' | 'doing' | 'none' = live ? 'doing' : submitted.length ? 'done' : 'none';
    const targetAttempt = best ?? live ?? list.at(-1) ?? null;
    return { p, list, best, targetAttempt, status, leaves: Math.max(0, ...list.map((t) => t.tab_leaves)), last: submitted.at(-1) };
  });
  rows.sort((x, y) => {
    if (!a.class_id && x.status !== y.status) {
      const rank = { doing: 0, done: 1, none: 2 };
      return rank[x.status] - rank[y.status];
    }
    return x.p.full_name.localeCompare(y.p.full_name, 'vi');
  });

  const done = rows.filter((r) => r.status === 'done');
  const avg = done.length ? done.reduce((t, r) => t + Number(r.best?.score ?? 0), 0) / done.length : null;
  const exportRows: ExportRow[] = rows.map((r, i) => ({
    stt: i + 1,
    name: r.p.full_name,
    username: r.p.isGuest ? 'Khách (chưa đăng nhập)' : r.p.username,
    status: r.status === 'done' ? 'Đã nộp' : r.status === 'doing' ? 'Đang làm' : 'Chưa làm',
    score: r.best?.score != null ? Number(r.best.score) : null,
    attempts: r.list.length,
    leaves: r.leaves,
    submitted: r.last?.submitted_at ? fmtDateTime(r.last.submitted_at) : '',
  }));
  const className = (a.classes as unknown as { name: string } | null)?.name ?? '';
  const state = now < new Date(a.opens_at).getTime()
    ? 'upcoming'
    : a.closes_at && now >= new Date(a.closes_at).getTime()
      ? 'closed'
      : 'open';

  return (
    <>
      <PageTitle title={a.title} back={{ href: `/gv/de/${a.exam_id}`, label: (a.exams as unknown as { title: string } | null)?.title ?? 'Đề thi' }}>
        <ExportButton rows={exportRows} fileName={className ? `${a.title} - ${className}` : a.title} />
      </PageTitle>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-4">
          <StatStrip
            items={[
              { label: 'Phạm vi', value: className ? `Lớp ${className}` : 'Link tự do' },
              { label: 'Đã nộp', value: a.class_id ? `${done.length}/${rows.length}` : `${done.length} bài` },
              { label: 'Đang làm', value: String(rows.filter((r) => r.status === 'doing').length) },
              { label: 'Điểm trung bình', value: avg == null ? '—' : fmtScore(avg), accent: avg != null },
            ]}
          />

          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            <div className="hidden grid-cols-[minmax(0,1fr)_7.5rem_5rem_5.5rem_8.5rem_1.25rem] items-center gap-3 bg-sunken px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted md:grid">
              <span>Học sinh</span>
              <span>Trạng thái</span>
              <span className="text-right">Điểm{a.max_attempts > 1 ? ' cao nhất' : ''}</span>
              <span className="text-right">Rời trang</span>
              <span>Nộp lúc</span>
              <span className="sr-only">Chi tiết</span>
            </div>
            <ul className="divide-y divide-line text-sm">
              {rows.map((r) => {
                const href = r.targetAttempt ? `/gv/bai-giao/${id}/bai-lam/${r.targetAttempt.id}` : null;
                return (
                  <li
                    key={r.p.key}
                    className={cx(
                      'group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors md:grid-cols-[minmax(0,1fr)_7.5rem_5rem_5.5rem_8.5rem_1.25rem]',
                      href && 'hover:bg-sunken/70 focus-within:bg-sunken/70',
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {href ? (
                          <Link href={href} className="row-link truncate font-medium text-ink transition-colors group-hover:text-brand">
                            {r.p.full_name}
                          </Link>
                        ) : (
                          <p className="truncate font-medium">{r.p.full_name}</p>
                        )}
                        {r.p.isGuest && <Badge>Khách</Badge>}
                        {r.p.outsider && <Badge tone="warn">Ngoài lớp</Badge>}
                      </div>
                      <p className="text-xs text-muted">
                        {r.p.isGuest ? 'Làm trực tiếp qua link' : r.p.username}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted md:hidden">
                        {r.status === 'done' ? <Badge tone="ok">Đã nộp{r.list.length > 1 ? ` · ${r.list.length} lượt` : ''}</Badge> : r.status === 'doing' ? <Badge tone="warn">Đang làm</Badge> : <Badge>Chưa làm</Badge>}
                        {r.list.length > 0 && <span className={r.leaves >= 3 ? 'font-semibold text-warn' : ''}>Rời trang {r.leaves}</span>}
                      </div>
                    </div>

                    <div className="hidden md:block">
                      {r.status === 'done' ? <Badge tone="ok">Đã nộp{r.list.length > 1 ? ` · ${r.list.length} lượt` : ''}</Badge> : r.status === 'doing' ? <Badge tone="warn">Đang làm</Badge> : <Badge>Chưa làm</Badge>}
                    </div>

                    <div className="num flex items-center justify-end gap-1.5 text-right">
                      {r.best ? <span className="grade-mark text-lg">{fmtScore(r.best.score)}</span> : <span className="text-muted">—</span>}
                      {href && <ChevronRight className="h-4 w-4 text-muted/60 md:hidden" aria-hidden />}
                    </div>

                    <span className={cx('num hidden text-right md:block', r.leaves >= 3 ? 'font-semibold text-warn' : 'text-muted')}>
                      {r.list.length ? r.leaves : '—'}
                    </span>

                    <span className="num hidden text-xs text-muted md:block">
                      {r.last?.submitted_at ? fmtDateTime(r.last.submitted_at) : ''}
                    </span>

                    <span className="hidden justify-end md:flex">
                      {href && <ChevronRight className="h-4 w-4 text-muted/60 transition-transform group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden />}
                    </span>
                  </li>
                );
              })}
              {!rows.length && (
                <li className="px-4 py-8 text-center text-muted">
                  Chưa có học sinh nào làm bài. Hãy chép link bên cạnh gửi qua Zalo cho học sinh!
                </li>
              )}
            </ul>
          </div>
          <p className="text-xs text-muted">Số lần rời trang chỉ mang tính tham khảo: một số trình duyệt (trong Zalo, Messenger) không báo chính xác.</p>
        </div>

        <aside className="grid gap-4 lg:sticky lg:top-4">
          <Panel>
            <h2 className="mb-2 font-semibold">Link gửi học sinh</h2>
            <CopyLink code={a.code} />
            {a.access_password && <p className="mt-2 text-sm">Mật khẩu: <b className="num">{a.access_password}</b></p>}
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Trạng thái</dt>
              <dd>{state === 'open' ? <Badge tone="brand">Đang mở</Badge> : state === 'upcoming' ? <Badge>Sắp mở</Badge> : <Badge tone="neutral">Đã đóng</Badge>}</dd>
              <dt className="text-muted">Truy cập</dt>
              <dd>{a.restrict_to_class && className ? `Chỉ HS lớp ${className}` : 'Mở (không cần đăng nhập)'}</dd>
              <dt className="text-muted">Mở</dt><dd className="num">{fmtDateTime(a.opens_at)}</dd>
              <dt className="text-muted">Đóng</dt><dd className="num">{a.closes_at ? fmtDateTime(a.closes_at) : 'Mở tự do'}</dd>
              <dt className="text-muted">Thời gian</dt><dd className="num">{a.duration_minutes} phút · {a.max_attempts} lượt</dd>
            </dl>
          </Panel>
          <AssignmentControls
            a={{
              id: a.id,
              code: a.code,
              title: a.title,
              class_id: a.class_id,
              restrict_to_class: a.restrict_to_class,
              opens_at: a.opens_at,
              closes_at: a.closes_at,
              duration_minutes: a.duration_minutes,
              max_attempts: a.max_attempts,
              shuffle_questions: a.shuffle_questions,
              shuffle_choices: a.shuffle_choices,
              result_mode: a.result_mode,
              result_release: a.result_release,
              access_password: a.access_password ?? '',
            }}
            classes={classes ?? []}
            open={state === 'open'}
          />
        </aside>
      </div>
    </>
  );
}
