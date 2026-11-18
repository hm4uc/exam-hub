'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireTeacher } from '@/server/auth';
import { QuestionInputSchema, toQuestionRow } from '@/domain/exam/question-io';
import type { QuestionInput, Scoring } from '@/domain/exam/types';
import { supabaseServer } from '@/server/supabase/server';

export type ActionResult = { ok: true; id?: string; message?: string } | { ok: false; error: string };

const CreateSchema = z.object({
  title: z.string().trim().min(1, 'Nhập tên đề.').max(200),
  sourcePath: z.string().max(500).nullable(),
  questions: z.array(QuestionInputSchema).min(1, 'Đề cần ít nhất 1 câu.').max(200),
});

export async function createExam(input: { title: string; sourcePath: string | null; questions: QuestionInput[] }): Promise<ActionResult> {
  await requireTeacher();
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await supabaseServer();
  const { data: exam, error } = await supabase.from('exams').insert({ title: parsed.data.title, source_path: parsed.data.sourcePath }).select('id').single();
  if (error || !exam) return { ok: false, error: 'Chưa lưu được đề. Hãy thử lại.' };
  const rows = parsed.data.questions.map((q) => ({ ...toQuestionRow(q), exam_id: exam.id }));
  const { error: qErr } = await supabase.from('questions').insert(rows);
  if (qErr) {
    await supabase.from('exams').delete().eq('id', exam.id);
    return { ok: false, error: 'Chưa lưu được câu hỏi. Hãy thử lại.' };
  }
  revalidatePath('/gv/de');
  return { ok: true, id: exam.id };
}

export async function updateQuestion(id: string, input: QuestionInput): Promise<ActionResult> {
  await requireTeacher();
  const parsed = QuestionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await supabaseServer();
  const row = toQuestionRow(parsed.data);
  const { data, error } = await supabase.from('questions').update(row).eq('id', id).select('exam_id').single();
  if (error || !data) return { ok: false, error: 'Chưa lưu được câu hỏi.' };
  revalidatePath(`/gv/de/${data.exam_id}`);
  return { ok: true, message: 'Đã lưu. Các bài đã nộp được chấm lại theo đáp án mới.' };
}

export async function deleteQuestion(id: string): Promise<ActionResult> {
  await requireTeacher();
  const supabase = await supabaseServer();
  const { data: q } = await supabase.from('questions').select('exam_id').eq('id', id).single();
  if (!q) return { ok: false, error: 'Không tìm thấy câu hỏi.' };
  const { count } = await supabase.from('assignments').select('id', { count: 'exact', head: true }).eq('exam_id', q.exam_id);
  if (count) return { ok: false, error: 'Đề đã được giao nên không xoá câu được (học sinh đã nhận đề). Bạn vẫn sửa nội dung, đáp án được.' };
  await supabase.from('questions').delete().eq('id', id);
  revalidatePath(`/gv/de/${q.exam_id}`);
  return { ok: true };
}

const MetaSchema = z.object({
  title: z.string().trim().min(1, 'Nhập tên đề.').max(200),
  scoring: z.object({ mcq: z.number().min(0).max(10), tf: z.number().min(0).max(10), short: z.number().min(0).max(10), scale10: z.boolean() }),
});

export async function updateExamMeta(id: string, input: { title: string; scoring: Scoring }): Promise<ActionResult> {
  await requireTeacher();
  const parsed = MetaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await supabaseServer();
  const { error } = await supabase.from('exams').update(parsed.data).eq('id', id);
  if (error) return { ok: false, error: 'Chưa lưu được.' };
  revalidatePath(`/gv/de/${id}`);
  return { ok: true, message: 'Đã lưu.' };
}

export async function setExamStatus(id: string, status: 'draft' | 'published'): Promise<ActionResult> {
  await requireTeacher();
  const supabase = await supabaseServer();
  await supabase.from('exams').update({ status }).eq('id', id);
  revalidatePath(`/gv/de/${id}`);
  revalidatePath('/gv/de');
  return { ok: true };
}

export async function deleteExam(id: string): Promise<ActionResult> {
  await requireTeacher();
  const supabase = await supabaseServer();
  const { count } = await supabase.from('assignments').select('id', { count: 'exact', head: true }).eq('exam_id', id);
  if (count) return { ok: false, error: `Đề đang được dùng ở ${count} bài giao. Xoá các bài giao trước.` };
  const { data: ex } = await supabase.from('exams').select('source_path').eq('id', id).single();
  await supabase.from('exams').delete().eq('id', id);
  if (ex?.source_path) await supabase.storage.from('exam-files').remove([ex.source_path]);
  revalidatePath('/gv/de');
  redirect('/gv/de');
}
