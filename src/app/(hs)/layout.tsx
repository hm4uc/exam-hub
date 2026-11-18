import Link from 'next/link';
import { UserMenu } from '@/components/user-menu';
import { requireStudent } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const me = await requireStudent();
  const supabase = await supabaseServer();
  const { data: cls } = me.class_id ? await supabase.from('classes').select('name').eq('id', me.class_id).maybeSingle() : { data: null };
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
          <Link href="/" className="font-bold tracking-tight text-brand">Exam Hub</Link>
          <UserMenu name={me.full_name} sub={cls?.name ? `Lớp ${cls.name}` : 'Chưa xếp lớp'} />
        </div>
      </header>
      {children}
    </>
  );
}
