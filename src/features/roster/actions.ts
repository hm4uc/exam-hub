'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireTeacher } from '@/server/auth';
import { supabaseAdmin } from '@/server/supabase/admin';
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

export async function setStudentClass(studentId: string, classId: string | null): Promise<Res> {
  await requireTeacher();
  if (!uuid.safeParse(studentId).success || (classId && !uuid.safeParse(classId).success)) return { ok: false, error: 'Dữ liệu không hợp lệ.' };
  const supabase = await supabaseServer();
  const { error } = await supabase.from('profiles').update({ class_id: classId }).eq('id', studentId).eq('role', 'student');
  if (error) return { ok: false, error: 'Chưa chuyển lớp được.' };
  revalidatePath('/gv/hoc-sinh');
  return { ok: true };
}

export async function renameStudent(studentId: string, fullName: string): Promise<Res> {
  await requireTeacher();
  const name = fullName.trim();
  if (!name || name.length > 80) return { ok: false, error: 'Họ tên không hợp lệ.' };
  const supabase = await supabaseServer();
  await supabase.from('profiles').update({ full_name: name }).eq('id', studentId).eq('role', 'student');
  revalidatePath('/gv/hoc-sinh');
  return { ok: true };
}

// Mật khẩu tạm dễ đọc cho học sinh (không có ký tự dễ nhầm)
function tempPassword() {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => a[b % a.length]).join('');
}

export async function resetPassword(studentId: string): Promise<Res> {
  await requireTeacher();
  if (!uuid.safeParse(studentId).success) return { ok: false, error: 'Dữ liệu không hợp lệ.' };
  const supabase = await supabaseServer();
  const { data: p } = await supabase.from('profiles').select('role').eq('id', studentId).single();
  if (p?.role !== 'student') return { ok: false, error: 'Chỉ đặt lại được mật khẩu học sinh.' };
  const password = tempPassword();
  const { error } = await supabaseAdmin().auth.admin.updateUserById(studentId, { password });
  if (error) return { ok: false, error: 'Chưa đặt lại được mật khẩu.' };
  await supabase.from('profiles').update({ must_change_password: true }).eq('id', studentId);
  await supabase.rpc('revoke_sessions', { p_user: studentId }); // đăng xuất mọi máy (bỏ qua nếu lỗi)
  revalidatePath('/gv/hoc-sinh');
  return { ok: true, password };
}

export async function setLocked(studentId: string, locked: boolean): Promise<Res> {
  await requireTeacher();
  if (!uuid.safeParse(studentId).success) return { ok: false, error: 'Dữ liệu không hợp lệ.' };
  const supabase = await supabaseServer();
  const { data: p } = await supabase.from('profiles').select('role').eq('id', studentId).single();
  if (p?.role !== 'student') return { ok: false, error: 'Không khoá được tài khoản này.' };
  const { error } = await supabaseAdmin().auth.admin.updateUserById(studentId, { ban_duration: locked ? '876000h' : 'none' });
  if (error) return { ok: false, error: 'Chưa cập nhật được.' };
  await supabase.from('profiles').update({ is_locked: locked }).eq('id', studentId);
  if (locked) await supabase.rpc('revoke_sessions', { p_user: studentId });
  revalidatePath('/gv/hoc-sinh');
  return { ok: true };
}
