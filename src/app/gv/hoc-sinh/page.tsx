import type { Metadata } from 'next';
import Link from 'next/link';
import { Empty, PageTitle, cx } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';
import { supabaseServer } from '@/server/supabase/server';
import { StudentRow } from '@/features/roster/student-row';

export const metadata: Metadata = { title: 'Học sinh' };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ lop?: string; q?: string }> }) {
  const { lop = '', q = '' } = await searchParams;
  const supabase = await supabaseServer();
  const { data: classes } = await supabase.from('classes').select('id, name').is('archived_at', null).order('name');
  let query = supabase.from('profiles').select('id, full_name, username, class_id, is_locked, must_change_password, created_at').eq('role', 'student').order('full_name').limit(500);
  if (lop === 'chua-xep') query = query.is('class_id', null);
  else if (/^[0-9a-f-]{36}$/.test(lop)) query = query.eq('class_id', lop);
  if (q.trim()) query = query.or(`full_name.ilike.%${q.trim().replace(/[%,()]/g, '')}%,username.ilike.%${q.trim().replace(/[%,()]/g, '')}%`);
  const { data: students } = await query;
  const tabs = [{ id: '', name: 'Tất cả' }, { id: 'chua-xep', name: 'Chưa xếp lớp' }, ...(classes ?? [])];

  // Học sinh trùng họ tên trong cùng lớp → cảnh báo
  const dupKey = (s: { class_id: string | null; full_name: string }) => `${s.class_id}|${s.full_name.trim().toLowerCase()}`;
  const counts = new Map<string, number>();
  for (const s of students ?? []) counts.set(dupKey(s), (counts.get(dupKey(s)) ?? 0) + 1);

  return (
    <>
      <PageTitle title="Học sinh" />
      <div className="mb-4 grid gap-3 md:flex md:items-center">
        <nav aria-label="Lọc theo lớp" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 md:pb-0">
          {tabs.map((t) => (
            <Link key={t.id || 'all'} href={`/gv/hoc-sinh${t.id ? `?lop=${t.id}` : ''}`} aria-current={lop === t.id ? 'page' : undefined}
              className={cx('inline-flex min-h-10 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium transition-colors', lop === t.id ? 'border-brand bg-brand text-brand-on' : 'border-line bg-surface hover:border-brand/50')}>
              {t.name}
            </Link>
          ))}
        </nav>
        <form className="md:ml-auto" role="search">
          {lop && <input type="hidden" name="lop" value={lop} />}
          <input name="q" type="search" defaultValue={q} placeholder="Tìm tên hoặc tên đăng nhập" aria-label="Tìm học sinh"
            className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 md:w-72 md:text-sm" />
        </form>
      </div>
      {!students?.length ? (
        <Empty title={lop === 'chua-xep' ? 'Không có học sinh nào chưa xếp lớp' : q ? `Không tìm thấy “${q}”` : 'Chưa có học sinh'}>
          {q ? 'Thử tìm bằng tên khác hoặc tên đăng nhập.' : 'Học sinh tự tạo tài khoản khi mở link bài kiểm tra bạn gửi.'}
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="hidden grid-cols-[minmax(0,1fr)_11rem_9rem_17rem] gap-4 bg-sunken px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted lg:grid">
            <span>Học sinh</span><span>Lớp</span><span>Tạo lúc</span><span className="sr-only">Thao tác</span>
          </div>
          <ul className="divide-y divide-line">
            {students.map((s) => (
              <StudentRow key={s.id} s={{ ...s, created: fmtDateTime(s.created_at), duplicate: (counts.get(dupKey(s)) ?? 0) > 1 }} classes={classes ?? []} />
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 text-sm text-muted num">{students?.length ?? 0} học sinh</p>
    </>
  );
}
