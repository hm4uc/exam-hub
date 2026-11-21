'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireTeacher } from '@/server/auth';
import { supabaseServer } from '@/server/supabase/server';

export type Res = { ok: true; message?: string; password?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };
const uuid = z.string().uuid();

export async function createClass(_: unknown, form: FormData): Promise<Res> {
  await requireTeacher();
  const name = String(form.get('name') ?? '').trim();
  const school_year = String(form.get('school_year') ?? '').trim() || null;
  if (!name) return { ok: false, error: 'Vui lòng nhập tên lớp.', fieldErrors: { name: 'Vui lòng nhập tên lớp.' } };
  if (name.length > 60) return { ok: false, error: 'Tên lớp tối đa 60 ký tự.', fieldErrors: { name: 'Tên lớp tối đa 60 ký tự.' } };
  if (school_year && school_year.length > 20) {
    return { ok: false, error: 'Năm học tối đa 20 ký tự.', fieldErrors: { school_year: 'Năm học tối đa 20 ký tự.' } };
  }
  const supabase = await supabaseServer();
  const { error } = await supabase.from('classes').insert({ name, school_year });
  if (error) {
    const dup = error.code === '23505';
    const msg = dup ? 'Đã có lớp trùng tên trong năm học này.' : 'Chưa tạo được lớp.';
    return { ok: false, error: msg, ...(dup ? { fieldErrors: { name: msg } } : {}) };
  }
  revalidatePath('/gv/lop');
  return { ok: true, message: `Đã tạo lớp ${name}.` };
}

export async function renameClass(id: string, name: string): Promise<Res> {
  await requireTeacher();
  const trimmed = name.trim();
  if (!uuid.safeParse(id).success) return { ok: false, error: 'Lớp không hợp lệ.' };
  if (!trimmed) return { ok: false, error: 'Vui lòng nhập tên lớp.', fieldErrors: { name: 'Vui lòng nhập tên lớp.' } };
  if (trimmed.length > 60) return { ok: false, error: 'Tên lớp tối đa 60 ký tự.', fieldErrors: { name: 'Tên lớp tối đa 60 ký tự.' } };
  const supabase = await supabaseServer();
  const { error } = await supabase.from('classes').update({ name: trimmed }).eq('id', id);
  if (error) {
    const dup = error.code === '23505';
    const msg = dup ? 'Đã có lớp trùng tên trong năm học này.' : 'Chưa đổi được tên lớp.';
    return { ok: false, error: msg, ...(dup ? { fieldErrors: { name: msg } } : {}) };
  }
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
