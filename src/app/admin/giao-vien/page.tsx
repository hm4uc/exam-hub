import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Empty, PageTitle } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';
import { CreateInviteForm, InviteRow } from '@/features/invites/invite-admin';
import { supabaseServer } from '@/server/supabase/server';

export const metadata: Metadata = { title: 'Giáo viên và mã mời' };

export default async function TeachersAdminPage() {
  const supabase = await supabaseServer();
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
  const [{ data: invites }, { data: teachers }, { data: students }] = await Promise.all([
    supabase.from('teacher_invites').select('code, note, uses, max_uses, expires_at').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, username, teacher_code, is_locked, created_at').eq('role', 'teacher').order('created_at'),
    supabase.from('profiles').select('owner_id').eq('role', 'student'),
  ]);
  const count = new Map<string, number>();
  for (const s of students ?? []) if (s.owner_id) count.set(s.owner_id, (count.get(s.owner_id) ?? 0) + 1);

  return (
    <>
      <PageTitle title="Giáo viên và mã mời" />
      <section aria-labelledby="inv-h" className="mb-8">
        <h2 id="inv-h" className="mb-2 text-base font-semibold">Mã mời đăng ký</h2>
        <CreateInviteForm />
        {invites?.length ? (
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {invites.map((i) => (
              <InviteRow key={i.code} code={i.code} link={`${origin}/dang-ky-giao-vien?ma=${i.code}`} note={i.note} uses={i.uses} maxUses={i.max_uses}
                expires={i.expires_at ? fmtDateTime(i.expires_at) : null} />
            ))}
          </ul>
        ) : (
          <div className="mt-4"><Empty title="Chưa có mã mời">Tạo mã rồi gửi link cho giáo viên được mời.</Empty></div>
        )}
      </section>

      <section aria-labelledby="gv-h">
        <h2 id="gv-h" className="mb-2 text-base font-semibold">Giáo viên ({teachers?.length ?? 0})</h2>
        {teachers?.length ? (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {teachers.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.full_name}{t.is_locked && <span className="ml-2 text-sm font-normal text-pen">(đã khoá)</span>}</p>
                  <p className="num text-sm text-muted">{t.username} · mã “{t.teacher_code ?? '—'}” · tạo {fmtDateTime(t.created_at)}</p>
                </div>
                <p className="num text-sm text-muted">{count.get(t.id) ?? 0} học sinh</p>
              </li>
            ))}
          </ul>
        ) : <Empty title="Chưa có giáo viên" />}
      </section>
    </>
  );
}
