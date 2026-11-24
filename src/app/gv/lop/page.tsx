import type { Metadata } from 'next';
import Link from 'next/link';
import { Empty, PageTitle } from '@/components/ui';
import { supabaseServer } from '@/server/supabase/server';
import { ClassRow, NewClassForm } from '@/features/roster/class-row';

export const metadata: Metadata = { title: 'Lớp' };

export default async function ClassesPage() {
  const supabase = await supabaseServer();
  const [{ data: classes }, { count: unassigned }] = await Promise.all([
    supabase.from('classes').select('id, name, school_year, archived_at, profiles!profiles_class_id_fkey(count), assignments(count)')
      .order('archived_at', { nullsFirst: true }).order('name'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student').is('class_id', null),
  ]);

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
          <Empty title="Chưa có lớp nào">Lớp là tùy chọn để quản lý sĩ số và gom nhóm bài giao — không tạo lớp bạn vẫn tạo đề và gửi link cho học sinh làm ngay được.</Empty>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-card">
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
