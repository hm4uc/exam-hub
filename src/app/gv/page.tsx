import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, Upload } from 'lucide-react';
import { Badge, ButtonLink, Empty, PageTitle, interactiveRowClass } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';
import { supabaseServer } from '@/server/supabase/server';

export const metadata: Metadata = { title: 'Tổng quan' };

export default async function TeacherHome() {
  const supabase = await supabaseServer();
  const nowIso = new Date().toISOString();
  const [{ data: open }, { data: recent }, { count: unassigned }, { count: examCount }] = await Promise.all([
    supabase
      .from('assignments')
      .select('id, title, code, closes_at, opens_at, classes(name), attempts(count)')
      .lte('opens_at', nowIso)
      .or(`closes_at.is.null,closes_at.gt.${nowIso}`)
      .order('created_at', { ascending: false }),
    supabase
      .from('assignments')
      .select('id, title, closes_at, opens_at, classes(name)')
      .or(`closes_at.lte.${nowIso},opens_at.gt.${nowIso}`)
      .order('opens_at', { ascending: false })
      .limit(8),
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
        <p className="mb-5 rounded-lg bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
          {unassigned} học sinh mới chưa xếp lớp. <Link href="/gv/hoc-sinh?lop=chua-xep" className="font-semibold underline">Xếp lớp</Link>
        </p>
      )}
      {!examCount && (
        <div className="mb-6"><Empty title="Bắt đầu bằng một đề Word">Tải đề lên → soát câu hỏi và đáp án → chép link gửi ngay qua Zalo cho học sinh làm bài.</Empty></div>
      )}
      <section>
        <h2 className="mb-3 text-base font-semibold">Đang mở</h2>
        {!open?.length ? (
          <p className="rounded-xl border border-dashed border-line bg-surface/60 px-4 py-6 text-center text-sm text-muted">Không có bài nào đang mở.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            {open.map((a) => {
              const className = cls(a.classes);
              return (
                <li key={a.id}>
                  <Link href={`/gv/bai-giao/${a.id}`} className={interactiveRowClass}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold transition-colors group-hover:text-brand">{a.title}</p>
                      <p className="mt-0.5 text-sm text-muted">
                        {className ? `Lớp ${className}` : 'Link tự do'} · {a.closes_at ? `đóng ${fmtDateTime(a.closes_at)}` : 'mở tự do'}
                      </p>
                    </div>
                    <Badge tone="brand" className="num">{(a.attempts as unknown as { count: number }[])[0]?.count ?? 0} lượt làm</Badge>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted/60 transition-transform group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {!!recent?.length && (
        <section className="mt-8">
          <h2 className="mb-3 text-base font-semibold">Sắp mở và đã đóng</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            {recent.map((a) => {
              const className = cls(a.classes);
              return (
                <li key={a.id}>
                  <Link href={`/gv/bai-giao/${a.id}`} className={interactiveRowClass}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium transition-colors group-hover:text-brand">{a.title}</p>
                      <p className="mt-0.5 text-sm text-muted">{className ? `Lớp ${className}` : 'Link tự do'}</p>
                    </div>
                    {new Date(a.opens_at) > new Date() ? <Badge>Mở {fmtDateTime(a.opens_at)}</Badge> : <Badge tone="neutral">Đã đóng</Badge>}
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted/60 transition-transform group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
