import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageTitle } from '@/components/ui';
import { supabaseServer } from '@/lib/supabase/server';
import { AssignForm } from './assign-form';

export const metadata: Metadata = { title: 'Giao bài' };

export default async function AssignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await supabaseServer();
  const [{ data: exam }, { data: classes }] = await Promise.all([
    supabase.from('exams').select('id, title').eq('id', id).maybeSingle(),
    supabase.from('classes').select('id, name').is('archived_at', null).order('name'),
  ]);
  if (!exam) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Giao bài" back={{ href: `/gv/de/${id}`, label: exam.title }} />
      <AssignForm examId={exam.id} examTitle={exam.title} classes={classes ?? []} />
    </div>
  );
}
