import type { Metadata } from 'next';
import Link from 'next/link';
import { Upload } from 'lucide-react';
import { Badge, ButtonLink, Empty, PageTitle } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';
import { supabaseServer } from '@/lib/supabase/server';

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
        <Empty title="Chưa có đề nào">Tải file Word đề lên, hệ thống sẽ tách câu hỏi, đáp án và lời giải để bạn soát lại.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="bg-sunken text-left text-xs uppercase tracking-wider text-muted">
              <tr><th className="px-4 py-2.5 font-semibold">Tên đề</th><th className="px-4 py-2.5 font-semibold">Số câu</th><th className="px-4 py-2.5 font-semibold">Đã giao</th><th className="px-4 py-2.5 font-semibold">Trạng thái</th><th className="px-4 py-2.5 font-semibold">Tạo lúc</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {exams.map((e) => (
                <tr key={e.id} className="hover:bg-sunken/60">
                  <td className="px-4 py-3"><Link href={`/gv/de/${e.id}`} className="font-semibold text-brand hover:underline">{e.title}</Link></td>
                  <td className="num px-4 py-3">{(e.questions as unknown as { count: number }[])[0]?.count ?? 0}</td>
                  <td className="num px-4 py-3">{(e.assignments as unknown as { count: number }[])[0]?.count ?? 0} lần</td>
                  <td className="px-4 py-3">{e.status === 'published' ? <Badge tone="ok">Đã xuất bản</Badge> : <Badge tone="warn">Nháp</Badge>}</td>
                  <td className="num px-4 py-3 text-muted">{fmtDateTime(e.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
