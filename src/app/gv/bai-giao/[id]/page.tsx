import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, PageTitle, Panel } from '@/components/ui';
import { fmtDateTime, fmtScore } from '@/lib/format';
import { supabaseServer } from '@/lib/supabase/server';
import { AssignmentControls, CopyLink, ExportButton, type ExportRow } from './client';

export const metadata: Metadata = { title: 'Bài giao' };

interface Att { id: string; student_id: string; attempt_no: number; submitted_at: string | null; deadline_at: string; score: number | null; tab_leaves: number }

export default async function AssignmentResults({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await supabaseServer();
  const { data: a } = await supabase
    .from('assignments')
    .select('id, code, title, exam_id, class_id, opens_at, closes_at, duration_minutes, max_attempts, access_password, result_mode, result_release, exams(title), classes(name)')
    .eq('id', id)
    .maybeSingle();
  if (!a) notFound();
  const [{ data: students }, { data: attempts }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, username').eq('class_id', a.class_id).eq('role', 'student').order('full_name'),
    supabase.from('attempts').select('id, student_id, attempt_no, submitted_at, deadline_at, score, tab_leaves').eq('assignment_id', id).order('attempt_no'),
  ]);
  const now = Date.now();
  const byStudent = new Map<string, Att[]>();
  for (const t of (attempts ?? []) as Att[]) byStudent.set(t.student_id, [...(byStudent.get(t.student_id) ?? []), t]);

  // Học sinh của lớp + học sinh đã làm nhưng nay ở lớp khác
  const roster = new Map((students ?? []).map((s) => [s.id, s]));
  const outsiders = [...byStudent.keys()].filter((sid) => !roster.has(sid));
  if (outsiders.length) {
    const { data: extra } = await supabase.from('profiles').select('id, full_name, username').in('id', outsiders);
    for (const s of extra ?? []) roster.set(s.id, s);
  }

  const rows = [...roster.values()].map((s) => {
    const list = byStudent.get(s.id) ?? [];
    const submitted = list.filter((t) => t.submitted_at);
    const live = list.find((t) => !t.submitted_at && new Date(t.deadline_at).getTime() + 30000 > now);
    const best = submitted.reduce<Att | null>((b, t) => (b == null || Number(t.score) > Number(b.score) ? t : b), null);
    const status: 'done' | 'doing' | 'none' = live ? 'doing' : submitted.length ? 'done' : 'none';
    return { s, list, best, status, leaves: Math.max(0, ...list.map((t) => t.tab_leaves)), last: submitted.at(-1) };
  });
  rows.sort((x, y) => x.s.full_name.localeCompare(y.s.full_name, 'vi'));
  const done = rows.filter((r) => r.status === 'done');
  const avg = done.length ? done.reduce((t, r) => t + Number(r.best?.score ?? 0), 0) / done.length : null;
  const exportRows: ExportRow[] = rows.map((r, i) => ({
    stt: i + 1, name: r.s.full_name, username: r.s.username,
    status: r.status === 'done' ? 'Đã nộp' : r.status === 'doing' ? 'Đang làm' : 'Chưa làm',
    score: r.best?.score != null ? Number(r.best.score) : null, attempts: r.list.length, leaves: r.leaves,
    submitted: r.last?.submitted_at ? fmtDateTime(r.last.submitted_at) : '',
  }));
  const className = (a.classes as unknown as { name: string } | null)?.name ?? '';
  const state = now < new Date(a.opens_at).getTime() ? 'upcoming' : now >= new Date(a.closes_at).getTime() ? 'closed' : 'open';

  return (
    <>
      <PageTitle title={a.title} back={{ href: `/gv/de/${a.exam_id}`, label: (a.exams as unknown as { title: string } | null)?.title ?? 'Đề thi' }}>
        <ExportButton rows={exportRows} fileName={`${a.title} - ${className}`} />
      </PageTitle>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Lớp', className],
              ['Đã nộp', `${done.length}/${rows.length}`],
              ['Đang làm', String(rows.filter((r) => r.status === 'doing').length)],
              ['Điểm trung bình', avg == null ? '—' : fmtScore(avg)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-line bg-surface px-4 py-3">
                <p className="text-xs text-muted">{k}</p>
                <p className="num mt-0.5 text-lg font-bold">{v}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-sunken text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Học sinh</th><th className="px-4 py-2.5 font-semibold">Trạng thái</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Điểm{a.max_attempts > 1 ? ' cao nhất' : ''}</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Rời trang</th><th className="px-4 py-2.5 font-semibold">Nộp lúc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.s.id} className="hover:bg-sunken/60">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{r.s.full_name}</p>
                      <p className="text-xs text-muted">{r.s.username}{!(students ?? []).some((x) => x.id === r.s.id) && ' · đã chuyển lớp'}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      {r.status === 'done' ? <Badge tone="ok">Đã nộp{r.list.length > 1 ? ` · ${r.list.length} lượt` : ''}</Badge> : r.status === 'doing' ? <Badge tone="warn">Đang làm</Badge> : <Badge>Chưa làm</Badge>}
                    </td>
                    <td className="num px-4 py-2.5 text-right">
                      {r.best ? <Link href={`/gv/bai-giao/${id}/bai-lam/${r.best.id}`} className="grade-mark text-base hover:underline">{fmtScore(r.best.score)}</Link> : <span className="text-muted">—</span>}
                    </td>
                    <td className={`num px-4 py-2.5 text-right ${r.leaves >= 3 ? 'font-semibold text-warn' : 'text-muted'}`}>{r.list.length ? r.leaves : '—'}</td>
                    <td className="num px-4 py-2.5 text-muted">{r.last?.submitted_at ? fmtDateTime(r.last.submitted_at) : ''}</td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Lớp chưa có học sinh. Học sinh tự đăng ký qua link sẽ được xếp vào lớp này.</td></tr>}
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
              <dt className="text-muted">Trạng thái</dt><dd>{state === 'open' ? <Badge tone="brand">Đang mở</Badge> : state === 'upcoming' ? <Badge>Sắp mở</Badge> : <Badge tone="neutral">Đã đóng</Badge>}</dd>
              <dt className="text-muted">Mở</dt><dd className="num">{fmtDateTime(a.opens_at)}</dd>
              <dt className="text-muted">Đóng</dt><dd className="num">{fmtDateTime(a.closes_at)}</dd>
              <dt className="text-muted">Thời gian</dt><dd className="num">{a.duration_minutes} phút · {a.max_attempts} lượt</dd>
            </dl>
          </Panel>
          <AssignmentControls a={{ id: a.id, title: a.title, opens_at: a.opens_at, closes_at: a.closes_at, result_mode: a.result_mode, result_release: a.result_release, access_password: a.access_password ?? '' }} open={state === 'open'} />
        </aside>
      </div>
    </>
  );
}
