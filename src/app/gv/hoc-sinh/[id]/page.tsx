import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Empty, PageTitle } from '@/components/ui';
import { AccountForm, DangerPanel, DeleteAttemptButton, PasswordPanel, type Account } from '@/features/accounts/account-editor';
import { fmtDateTime, fmtScore } from '@/lib/format';
import { requireTeacher } from '@/server/auth';
import { supabaseServer } from '@/server/supabase/server';

export const metadata: Metadata = { title: 'Tài khoản' };

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const me = await requireTeacher();
  const supabase = await supabaseServer();
  const [{ data: a }, { data: classes }, { data: attempts }] = await Promise.all([
    supabase.from('profiles').select('id, role, full_name, username, class_id, is_locked, must_change_password, created_at').eq('id', id).maybeSingle(),
    supabase.from('classes').select('id, name').is('archived_at', null).order('name'),
    supabase.from('attempts').select('id, attempt_no, started_at, submitted_at, score, assignment_id, assignments(title)').eq('student_id', id).order('started_at', { ascending: false }),
  ]);
  if (!a) notFound();
  const acc = a as Account;

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle title={a.full_name} back={{ href: a.role === 'teacher' ? '/gv/hoc-sinh?lop=giao-vien' : '/gv/hoc-sinh', label: 'Tài khoản' }}>
        <div className="flex flex-wrap gap-1.5 self-center">
          {a.role === 'teacher' ? <Badge tone="brand">Giáo viên</Badge> : <Badge>Học sinh</Badge>}
          {a.is_locked && <Badge tone="pen">Đã khoá</Badge>}
        </div>
      </PageTitle>
      <p className="-mt-3 mb-5 text-sm text-muted">{a.username} · tạo {fmtDateTime(a.created_at)}</p>

      <div className="grid gap-4">
        <AccountForm a={acc} classes={classes ?? []} isSelf={a.id === me.id} />

        {a.role === 'student' && (
          <section>
            <h2 className="mb-3 font-semibold">Bài làm</h2>
            {!attempts?.length ? <Empty title="Chưa làm bài nào" /> : (
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {attempts.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/gv/bai-giao/${t.assignment_id}/bai-lam/${t.id}`} className="font-medium text-brand hover:underline">
                        {(t.assignments as unknown as { title: string } | null)?.title}
                      </Link>
                      <p className="num text-xs text-muted">Lượt {t.attempt_no} · {t.submitted_at ? `nộp ${fmtDateTime(t.submitted_at)}` : 'chưa nộp'}</p>
                    </div>
                    {t.submitted_at ? <span className="grade-mark num text-lg">{fmtScore(t.score)}</span> : <Badge tone="warn">Đang làm</Badge>}
                    <DeleteAttemptButton id={t.id} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <PasswordPanel a={acc} />
          {a.id !== me.id && <DangerPanel a={acc} attempts={attempts?.length ?? 0} />}
        </div>
      </div>
    </div>
  );
}
