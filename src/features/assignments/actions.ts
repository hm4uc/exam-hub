'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireTeacher } from '@/server/auth';
import { supabaseServer } from '@/server/supabase/server';
import { recordTrace } from '@/server/trace';

export type AsgState = { error?: string; ok?: boolean } | undefined;

const OptionalUuid = z.union([z.literal(''), z.string().uuid({ message: 'Lớp không hợp lệ.' })]).transform((v) => v || null);
const OptionalDate = z.union([z.literal(''), z.string().datetime({ offset: true, message: 'Giờ đóng không hợp lệ.' })]).transform((v) => v || null);

const Schema = z
  .object({
    exam_id: z.string().uuid(),
    class_id: OptionalUuid,
    restrict_to_class: z.boolean(),
    title: z.string().trim().min(1, 'Nhập tên bài.').max(200),
    opens_at: z.string().datetime({ offset: true, message: 'Giờ mở không hợp lệ.' }),
    closes_at: OptionalDate,
    duration_minutes: z.coerce.number().int().min(1, 'Thời gian làm ít nhất 1 phút.').max(600),
    max_attempts: z.coerce.number().int().min(1).max(20),
    shuffle_questions: z.boolean(),
    shuffle_choices: z.boolean(),
    access_password: z.string().trim().max(40),
    result_mode: z.enum(['none', 'score', 'score_answers']),
    result_release: z.enum(['on_submit', 'after_close']),
  })
  .refine((v) => !v.closes_at || new Date(v.closes_at) > new Date(v.opens_at), { message: 'Giờ đóng phải sau giờ mở.' });

const fromForm = (f: FormData) => ({
  exam_id: String(f.get('exam_id') ?? ''),
  class_id: String(f.get('class_id') ?? ''),
  restrict_to_class: f.get('restrict_to_class') === 'on',
  title: String(f.get('title') ?? ''),
  opens_at: String(f.get('opens_at') ?? ''),
  closes_at: String(f.get('closes_at') ?? ''),
  duration_minutes: f.get('duration_minutes'),
  max_attempts: f.get('max_attempts'),
  shuffle_questions: f.get('shuffle_questions') === 'on',
  shuffle_choices: f.get('shuffle_choices') === 'on',
  access_password: String(f.get('access_password') ?? ''),
  result_mode: String(f.get('result_mode') ?? 'score_answers'),
  result_release: String(f.get('result_release') ?? 'on_submit'),
});

export async function createAssignment(_: AsgState, form: FormData): Promise<AsgState> {
  const me = await requireTeacher();
  const parsed = Schema.safeParse(fromForm(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from('assignments')
    .insert({
      ...v,
      restrict_to_class: v.class_id ? v.restrict_to_class : false,
      access_password: v.access_password || null,
    })
    .select('id, code')
    .single();
  if (error || !data) return { error: 'Chưa tạo được link bài làm. Hãy thử lại.' };
  await supabase.from('exams').update({ status: 'published' }).eq('id', v.exam_id);
  void recordTrace({
    level: 'info',
    category: 'admin',
    event: 'assignment_created',
    user_id: me.id,
    username: me.username,
    assignment_code: data.code,
    path: `/gv/de/${v.exam_id}/giao`,
    message: `Tạo link "${v.title}"`,
    meta: { assignment_id: data.id, class_id: v.class_id, restrict_to_class: v.class_id ? v.restrict_to_class : false },
  });
  revalidatePath('/gv');
  revalidatePath(`/gv/de/${v.exam_id}`);
  redirect(`/gv/bai-giao/${data.id}`);
}

/** Tạo nhanh 1 link làm bài mặc định cho đề chưa có link nào. */
export async function createQuickAssignment(examId: string) {
  const me = await requireTeacher();
  if (!z.string().uuid().safeParse(examId).success) return;
  const supabase = await supabaseServer();
  const { data: exam } = await supabase.from('exams').select('id, title').eq('id', examId).maybeSingle();
  if (!exam) return;
  const { data } = await supabase
    .from('assignments')
    .insert({
      exam_id: exam.id,
      class_id: null,
      title: exam.title,
      opens_at: new Date().toISOString(),
      closes_at: null,
      duration_minutes: 45,
      max_attempts: 1,
      shuffle_questions: true,
      shuffle_choices: true,
      access_password: null,
      result_mode: 'score_answers',
      result_release: 'on_submit',
      restrict_to_class: false,
      is_quick_link: true,
    })
    .select('id, code')
    .maybeSingle();
  await supabase.from('exams').update({ status: 'published' }).eq('id', exam.id);
  void recordTrace({
    level: 'info',
    category: 'admin',
    event: 'assignment_created',
    user_id: me.id,
    username: me.username,
    assignment_code: data?.code ?? null,
    path: `/gv/de/${exam.id}`,
    message: `Tạo link nhanh cho "${exam.title}"`,
  });
  revalidatePath('/gv');
  revalidatePath(`/gv/de/${exam.id}`);
}

const UpdateSchema = z
  .object({
    title: z.string().trim().min(1, 'Nhập tên bài.').max(200),
    class_id: OptionalUuid,
    restrict_to_class: z.boolean(),
    opens_at: z.string().datetime({ offset: true, message: 'Giờ mở không hợp lệ.' }),
    closes_at: OptionalDate,
    duration_minutes: z.coerce.number().int().min(1, 'Thời gian làm ít nhất 1 phút.').max(600),
    max_attempts: z.coerce.number().int().min(1).max(20),
    shuffle_questions: z.boolean(),
    shuffle_choices: z.boolean(),
    result_mode: z.enum(['none', 'score', 'score_answers']),
    result_release: z.enum(['on_submit', 'after_close']),
    access_password: z.string().trim().max(40),
  })
  .refine((v) => !v.closes_at || new Date(v.closes_at) > new Date(v.opens_at), { message: 'Giờ đóng phải sau giờ mở.' });

export async function updateAssignment(id: string, _: AsgState, form: FormData): Promise<AsgState> {
  await requireTeacher();
  const parsed = UpdateSchema.safeParse({
    title: String(form.get('title') ?? ''),
    class_id: String(form.get('class_id') ?? ''),
    restrict_to_class: form.get('restrict_to_class') === 'on',
    opens_at: String(form.get('opens_at') ?? ''),
    closes_at: String(form.get('closes_at') ?? ''),
    duration_minutes: form.get('duration_minutes'),
    max_attempts: form.get('max_attempts'),
    shuffle_questions: form.get('shuffle_questions') === 'on',
    shuffle_choices: form.get('shuffle_choices') === 'on',
    result_mode: String(form.get('result_mode') ?? 'score_answers'),
    result_release: String(form.get('result_release') ?? 'on_submit'),
    access_password: String(form.get('access_password') ?? ''),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const supabase = await supabaseServer();
  const { data: updated, error } = await supabase
    .from('assignments')
    .update({
      ...v,
      restrict_to_class: v.class_id ? v.restrict_to_class : false,
      access_password: v.access_password || null,
    })
    .eq('id', id)
    .select('exam_id')
    .maybeSingle();
  if (error) return { error: 'Chưa lưu được.' };
  revalidatePath('/gv');
  revalidatePath(`/gv/bai-giao/${id}`);
  if (updated?.exam_id) revalidatePath(`/gv/de/${updated.exam_id}`);
  return { ok: true };
}

export async function closeNow(id: string) {
  await requireTeacher();
  const supabase = await supabaseServer();
  const { data: a } = await supabase.from('assignments').select('opens_at, exam_id').eq('id', id).single();
  const now = new Date();
  const opens = a ? new Date(a.opens_at) : now;
  await supabase.from('assignments').update({ closes_at: (opens < now ? now : new Date(opens.getTime() + 1000)).toISOString() }).eq('id', id);
  revalidatePath('/gv');
  revalidatePath(`/gv/bai-giao/${id}`);
  if (a?.exam_id) revalidatePath(`/gv/de/${a.exam_id}`);
}

export async function reopenNow(id: string) {
  await requireTeacher();
  const supabase = await supabaseServer();
  const { data: a } = await supabase.from('assignments').select('opens_at, exam_id').eq('id', id).single();
  const now = new Date();
  const patch: { closes_at: null; opens_at?: string } = { closes_at: null };
  if (a && new Date(a.opens_at) > now) patch.opens_at = now.toISOString();
  await supabase.from('assignments').update(patch).eq('id', id);
  revalidatePath('/gv');
  revalidatePath(`/gv/bai-giao/${id}`);
  if (a?.exam_id) revalidatePath(`/gv/de/${a.exam_id}`);
}

export async function deleteAssignment(id: string) {
  await requireTeacher();
  const supabase = await supabaseServer();
  const { data: a } = await supabase.from('assignments').select('exam_id').eq('id', id).maybeSingle();
  await supabase.from('assignments').delete().eq('id', id);
  revalidatePath('/gv');
  if (a?.exam_id) revalidatePath(`/gv/de/${a.exam_id}`);
  redirect('/gv');
}
