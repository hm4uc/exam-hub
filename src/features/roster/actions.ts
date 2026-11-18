'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireTeacher } from '@/server/auth';
import { supabaseServer } from '@/server/supabase/server';

export type Res = { ok: true; message?: string; password?: string } | { ok: false; error: string };
const uuid = z.string().uuid();

export async function createClass(_: unknown, form: FormData): Promise<Res> {
  await requireTeacher();
  const name = String(form.get('name') ?? '').trim();
  const school_year = String(form.get('school_year') ?? '').trim() || null;
  if (!name) return { ok: false, error: 'Nhập tên lớp.' };
  const supabase = await supabaseServer();
  const { error } = await supabase.from('classes').insert({ name, school_year });
  if (error) return { ok: false, error: error.code === '23505' ? 'Đã có lớp trùng tên trong năm học này.' : 'Chưa tạo được lớp.' };
  revalidatePath('/gv/lop');
  return { ok: true, message: `Đã tạo lớp ${name}.` };
}

export async function renameClass(id: string, name: string): Promise<Res> {
  await requireTeacher();
  if (!uuid.safeParse(id).success || !name.trim()) return { ok: false, error: 'Tên lớp không hợp lệ.' };
  const supabase = await supabaseServer();
  const { error } = await supabase.from('classes').update({ name: name.trim() }).eq('id', id);
  if (error) return { ok: false, error: 'Chưa đổi được tên lớp.' };
  revalidatePath('/gv/lop');
  return { ok: true };
}

export async function archiveClass(id: string, archived: boolean): Promise<Res> {
  await requireTeacher();
  const supabase = await supabaseServer();
  await supabase.from('classes').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', id);
  revalidatePath('/gv/lop');
  return { ok: true };
}
