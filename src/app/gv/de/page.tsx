import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, Eye, Upload } from 'lucide-react';
import { Badge, ButtonLink, Empty, PageTitle } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';
import { supabaseServer } from '@/server/supabase/server';

export const metadata: Metadata = { title: 'Đề thi' };

export default async function ExamsPage() {
  const supabase = await supabaseServer();
  const { data: exams } = await supabase
    .from('exams')
    .select('id, title, status, created_at, questions(count), assignments(count)')
    .order('created_at', { ascending: false });

  return (
    <>
      <PageTitle title="Đề thi">
        <ButtonLink href="/gv/de/moi"><Upload className="h-4 w-4" aria-hidden />Tải đề Word lên</ButtonLink>
      </PageTitle>
      {!exams?.length ? (
        <Empty title="Chưa có đề nào">Tải file Word đề lên, hệ thống sẽ tách câu hỏi, đáp án và tạo sẵn link làm bài ngay.</Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
          <div className="hidden grid-cols-[minmax(0,1fr)_5.5rem_6.5rem_7.5rem_9.5rem_7.5rem] items-center gap-3 bg-sunken px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted md:grid">
            <span>Tên đề</span>
            <span>Số câu</span>
            <span>Link làm</span>
            <span>Trạng thái</span>
            <span>Tạo lúc</span>
            <span className="sr-only">Xem trước</span>
          </div>
          <ul className="divide-y divide-line">
            {exams.map((e) => {
              const qCount = (e.questions as unknown as { count: number }[])[0]?.count ?? 0;
              const asgCount = (e.assignments as unknown as { count: number }[])[0]?.count ?? 0;
              return (
                <li
                  key={e.id}
                  className="group relative grid items-center gap-3 px-4 py-3.5 transition-colors hover:bg-sunken/70 focus-within:bg-sunken/70 md:grid-cols-[minmax(0,1fr)_5.5rem_6.5rem_7.5rem_9.5rem_7.5rem]"
                >
                  <div className="min-w-0 pr-16 md:pr-0">
                    <Link href={`/gv/de/${e.id}`} className="row-link block truncate font-semibold text-ink transition-colors group-hover:text-brand">
                      {e.title}
                    </Link>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted md:hidden">
                      <span className="num font-medium text-ink/80">{qCount} câu</span>
                      <span>·</span>
                      <span className="num">{asgCount} link</span>
                      {e.status === 'published' ? <Badge tone="ok">Đã xuất bản</Badge> : <Badge tone="warn">Nháp</Badge>}
                    </p>
                  </div>
                  <span className="num hidden text-sm md:block">{qCount} câu</span>
                  <span className="num hidden text-sm text-muted md:block">{asgCount} link</span>
                  <span className="hidden md:block">
                    {e.status === 'published' ? <Badge tone="ok">Đã xuất bản</Badge> : <Badge tone="warn">Nháp</Badge>}
                  </span>
                  <span className="num hidden text-xs text-muted md:block">{fmtDateTime(e.created_at)}</span>
                  <div className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1 md:static md:translate-y-0 md:justify-end">
                    <Link
                      href={`/gv/de/${e.id}/xem-truoc`}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-transparent px-2.5 text-xs font-semibold text-muted transition-colors hover:border-line hover:bg-surface hover:text-brand"
                    >
                      <Eye className="h-4 w-4" aria-hidden />
                      <span className="hidden sm:inline">Xem trước</span>
                    </Link>
                    <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted/60 transition-transform group-hover:translate-x-0.5 group-hover:text-brand md:block" aria-hidden />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
