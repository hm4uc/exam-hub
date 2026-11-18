'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireTeacher } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';

export type AsgState = { error?: string } | undefined;

const Schema = z
  .object({
    exam_id: z.string().uuid(),
    class_id: z.string().uuid({ message: 'Chọn lớp.' }),
    title: z.string().trim().min(1, 'Nhập tên bài.').max(200),
    opens_at: z.string().datetime({ offset: true, message: 'Giờ mở không hợp lệ.' }),
    closes_at: z.string().datetime({ offset: true, message: 'Giờ đóng không hợp lệ.' }),
    duration_minutes: z.coerce.number().int().min(1, 'Thời gian làm ít nhất 1 phút.').max(600),
    max_attempts: z.coerce.number().int().min(1).max(20),
    shuffle_questions: z.boolean(),
    shuffle_choices: z.boolean(),
    access_password: z.string().trim().max(40),
    result_mode: z.enum(['none', 'score', 'score_answers']),
    result_release: z.enum(['on_submit', 'after_close']),
  })
  .refine((v) => new Date(v.closes_at) > new Date(v.opens_at), { message: 'Giờ đóng phải sau giờ mở.' });

const fromForm = (f: FormData) => ({
  exam_id: String(f.get('exam_id') ?? ''),
  class_id: String(f.get('class_id') ?? ''),
  title: String(f.get('title') ?? ''),
  opens_at: String(f.get('opens_at') ?? ''),
  closes_at: String(f.get('closes_at') ?? ''),
  duration_minutes: f.get('duration_minutes'),
  max_attempts: f.get('max_attempts'),
  shuffle_questions: f.get('shuffle_questions') === 'on',
  shuffle_choices: f.get('shuffle_choices') === 'on',
  access_password: String(f.get('access_password') ?? ''),
  result_mode: String(f.get('result_mode') ?? 'score'),
  result_release: String(f.get('result_release') ?? 'on_submit'),
});

export async function createAssignment(_: AsgState, form: FormData): Promise<AsgState> {
  await requireTeacher();
  const parsed = Schema.safeParse(fromForm(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from('assignments')
    .insert({ ...v, access_password: v.access_password || null })
    .select('id')
    .single();
  if (error || !data) return { error: 'Chưa giao được bài. Hãy thử lại.' };
  await supabase.from('exams').update({ status: 'published' }).eq('id', v.exam_id);
  revalidatePath('/gv');
  redirect(`/gv/bai-giao/${data.id}`);
}

const UpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    opens_at: z.string().datetime({ offset: true }),
    closes_at: z.string().datetime({ offset: true }),
    result_mode: z.enum(['none', 'score', 'score_answers']),
    result_release: z.enum(['on_submit', 'after_close']),
    access_password: z.string().trim().max(40),
  })
  .refine((v) => new Date(v.closes_at) > new Date(v.opens_at), { message: 'Giờ đóng phải sau giờ mở.' });

export async function updateAssignment(id: string, _: AsgState, form: FormData): Promise<AsgState> {
  await requireTeacher();
  const parsed = UpdateSchema.safeParse({
    title: form.get('title'), opens_at: form.get('opens_at'), closes_at: form.get('closes_at'),
    result_mode: form.get('result_mode'), result_release: form.get('result_release'), access_password: form.get('access_password') ?? '',
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await supabaseServer();
  const { error } = await supabase.from('assignments').update({ ...parsed.data, access_password: parsed.data.access_password || null }).eq('id', id);
  if (error) return { error: 'Chưa lưu được.' };
  revalidatePath(`/gv/bai-giao/${id}`);
  return {};
}

export async function closeNow(id: string) {
  await requireTeacher();
  const supabase = await supabaseServer();
  const { data: a } = await supabase.from('assignments').select('opens_at').eq('id', id).single();
  const now = new Date();
  const opens = a ? new Date(a.opens_at) : now;
  await supabase.from('assignments').update({ closes_at: (opens < now ? now : new Date(opens.getTime() + 1000)).toISOString() }).eq('id', id);
  revalidatePath(`/gv/bai-giao/${id}`);
}

export async function deleteAssignment(id: string) {
  await requireTeacher();
  const supabase = await supabaseServer();
  await supabase.from('assignments').delete().eq('id', id);
  revalidatePath('/gv');
  redirect('/gv');
}
