import type { Metadata } from 'next';
import Link from 'next/link';
import { Empty, PageTitle } from '@/components/ui';
import { supabaseServer } from '@/lib/supabase/server';
import { ClassRow, NewClassForm } from './client';

export const metadata: Metadata = { title: 'Lớp' };

export default async function ClassesPage() {
  const supabase = await supabaseServer();
  const { data: classes } = await supabase
    .from('classes')
    .select('id, name, school_year, archived_at, profiles(count), assignments(count)')
    .order('archived_at', { nullsFirst: true })
    .order('name');
  const { count: unassigned } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student').is('class_id', null);

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle title="Lớp" />
      <NewClassForm />
      {!!unassigned && (
        <p className="mt-4 rounded-lg bg-warn-soft px-3 py-2.5 text-sm text-warn">
          Có {unassigned} học sinh chưa xếp lớp. <Link href="/gv/hoc-sinh?lop=chua-xep" className="font-semibold underline">Xếp lớp ngay</Link>
        </p>
      )}
      <div className="mt-5">
        {!classes?.length ? (
          <Empty title="Chưa có lớp nào">Tạo lớp rồi giao bài cho lớp. Học sinh đăng ký qua link bài sẽ tự vào lớp đó.</Empty>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {classes.map((c) => (
              <ClassRow key={c.id} c={{
                id: c.id, name: c.name, school_year: c.school_year, archived: !!c.archived_at,
                students: (c.profiles as unknown as { count: number }[])[0]?.count ?? 0,
                assignments: (c.assignments as unknown as { count: number }[])[0]?.count ?? 0,
              }} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
