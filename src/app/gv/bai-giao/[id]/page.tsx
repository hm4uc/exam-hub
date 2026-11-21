import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, PageTitle, Panel } from '@/components/ui';
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

  // 1. Học sinh trong lớp (nếu bài giao có gắn lớp)
  for (const s of students ?? []) {
    participants.set(`u:${s.id}`, { key: `u:${s.id}`, full_name: s.full_name, username: s.username, isGuest: false, outsider: false });
  }

  // 2. Học sinh có tài khoản đã làm nhưng không nằm trong lớp hiện tại (hoặc bài giao mở tự do)
  const extraIds = [...loggedInStudentIds].filter((sid) => !classStudentSet.has(sid));
  if (extraIds.length) {
    const { data: extra } = await supabase.from('profiles').select('id, full_name, username').in('id', extraIds);
    for (const s of extra ?? []) {
      participants.set(`u:${s.id}`, { key: `u:${s.id}`, full_name: s.full_name, username: s.username, isGuest: false, outsider: !!a.class_id });
    }
  }

  // 3. Học sinh không đăng nhập (khách)
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
    return { p, list, best, status, leaves: Math.max(0, ...list.map((t) => t.tab_leaves)), last: submitted.at(-1) };
  });
  rows.sort((x, y) => {
    // Ưu tiên người đã làm/đang làm lên trước nếu bài tự do; hoặc sắp tên theo tiếng Việt
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
          <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface sm:grid-cols-4">
            {[
              ['Phạm vi', className ? `Lớp ${className}` : 'Link tự do'],
              ['Đã nộp', a.class_id ? `${done.length}/${rows.length}` : `${done.length} bài`],
              ['Đang làm', String(rows.filter((r) => r.status === 'doing').length)],
              ['Điểm trung bình', avg == null ? '—' : fmtScore(avg)],
            ].map(([k, v], i) => (
              <div key={k} className={`px-4 py-3 ${i % 2 ? 'border-l border-line' : ''} ${i >= 2 ? 'border-t border-line sm:border-t-0 sm:border-l' : ''}`}>
                <dt className="text-xs text-muted">{k}</dt>
                <dd className={`num mt-0.5 truncate text-lg font-bold ${k === 'Điểm trung bình' && avg != null ? 'grade-mark' : ''}`}>{v}</dd>
              </div>
            ))}
          </dl>

          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-sunken text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Học sinh</th>
                  <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">Trạng thái</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Điểm{a.max_attempts > 1 ? ' cao nhất' : ''}</th>
                  <th className="hidden px-4 py-2.5 text-right font-semibold md:table-cell">Rời trang</th>
                  <th className="hidden px-4 py-2.5 font-semibold md:table-cell">Nộp lúc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.p.key} className="hover:bg-sunken/60">
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-medium">{r.p.full_name}</p>
                        {r.p.isGuest && <Badge>Khách</Badge>}
                        {r.p.outsider && <Badge tone="warn">Ngoài lớp</Badge>}
                      </div>
                      <p className="text-xs text-muted">
                        {r.p.isGuest ? 'Làm trực tiếp qua link' : r.p.username}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted sm:hidden">
                        {r.status === 'done' ? <Badge tone="ok">Đã nộp{r.list.length > 1 ? ` · ${r.list.length} lượt` : ''}</Badge> : r.status === 'doing' ? <Badge tone="warn">Đang làm</Badge> : <Badge>Chưa làm</Badge>}
                        {r.list.length > 0 && <span className={r.leaves >= 3 ? 'font-semibold text-warn' : ''}>Rời trang {r.leaves}</span>}
                      </div>
                    </td>
                    <td className="hidden px-4 py-2.5 sm:table-cell">
                      {r.status === 'done' ? <Badge tone="ok">Đã nộp{r.list.length > 1 ? ` · ${r.list.length} lượt` : ''}</Badge> : r.status === 'doing' ? <Badge tone="warn">Đang làm</Badge> : <Badge>Chưa làm</Badge>}
                    </td>
                    <td className="num px-4 py-2.5 text-right">
                      {r.best ? <Link href={`/gv/bai-giao/${id}/bai-lam/${r.best.id}`} className="grade-mark inline-flex min-h-10 items-center text-lg hover:underline">{fmtScore(r.best.score)}</Link> : <span className="text-muted">—</span>}
                    </td>
                    <td className={`num hidden px-4 py-2.5 text-right md:table-cell ${r.leaves >= 3 ? 'font-semibold text-warn' : 'text-muted'}`}>{r.list.length ? r.leaves : '—'}</td>
                    <td className="num hidden px-4 py-2.5 text-muted md:table-cell">{r.last?.submitted_at ? fmtDateTime(r.last.submitted_at) : ''}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted">
                      Chưa có học sinh nào làm bài. Hãy chép link bên cạnh gửi qua Zalo cho học sinh!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
