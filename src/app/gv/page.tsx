import type { Metadata } from 'next';
import Link from 'next/link';
import { Upload } from 'lucide-react';
import { Badge, ButtonLink, Empty, PageTitle } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';
import { supabaseServer } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Tổng quan' };

export default async function TeacherHome() {
  const supabase = await supabaseServer();
  const nowIso = new Date().toISOString();
  const [{ data: open }, { data: recent }, { count: unassigned }, { count: examCount }] = await Promise.all([
    supabase.from('assignments').select('id, title, code, closes_at, opens_at, classes(name), attempts(count)').lte('opens_at', nowIso).gt('closes_at', nowIso).order('closes_at'),
    supabase.from('assignments').select('id, title, closes_at, opens_at, classes(name)').or(`closes_at.lte.${nowIso},opens_at.gt.${nowIso}`).order('opens_at', { ascending: false }).limit(8),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student').is('class_id', null),
    supabase.from('exams').select('id', { count: 'exact', head: true }),
  ]);
  const cls = (x: unknown) => (x as { name: string } | null)?.name ?? '';

  return (
    <>
      <PageTitle title="Tổng quan">
        <ButtonLink href="/gv/de/moi"><Upload className="h-4 w-4" aria-hidden />Tải đề Word lên</ButtonLink>
      </PageTitle>
      {!!unassigned && (
        <p className="mb-5 rounded-lg bg-warn-soft px-3 py-2.5 text-sm text-warn">
          {unassigned} học sinh mới chưa xếp lớp. <Link href="/gv/hoc-sinh?lop=chua-xep" className="font-semibold underline">Xếp lớp</Link>
        </p>
      )}
      {!examCount && (
        <div className="mb-6"><Empty title="Bắt đầu bằng một đề Word">Tải đề lên → soát câu hỏi và đáp án → giao cho lớp → gửi link qua Zalo cho học sinh.</Empty></div>
      )}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">Đang mở</h2>
        {!open?.length ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">Không có bài nào đang mở.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {open.map((a) => (
              <li key={a.id}>
                <Link href={`/gv/bai-giao/${a.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-sunken">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{a.title}</p>
                    <p className="text-sm text-muted">Lớp {cls(a.classes)} · đóng {fmtDateTime(a.closes_at)}</p>
                  </div>
                  <Badge tone="brand" className="num">{(a.attempts as unknown as { count: number }[])[0]?.count ?? 0} lượt làm</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      {!!recent?.length && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">Sắp mở và đã đóng</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {recent.map((a) => (
              <li key={a.id}>
                <Link href={`/gv/bai-giao/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-sunken">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.title}</p>
                    <p className="text-sm text-muted">Lớp {cls(a.classes)}</p>
                  </div>
                  {new Date(a.opens_at) > new Date() ? <Badge>Mở {fmtDateTime(a.opens_at)}</Badge> : <Badge tone="neutral">Đã đóng</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
