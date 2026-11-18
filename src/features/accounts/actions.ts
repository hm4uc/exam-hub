'use server';
// Quản lý tài khoản: giáo viên (admin) có toàn quyền thêm / sửa / xoá mọi tài khoản và bài làm.
// Thao tác trên auth.users dùng service role, luôn sau requireTeacher(). Không cho tự xoá / tự khoá / tự hạ quyền.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireTeacher } from '@/server/auth';
import { supabaseAdmin } from '@/server/supabase/admin';
import { usernameToEmail } from '@/server/supabase/env';
import { supabaseServer } from '@/server/supabase/server';

export type Res = { ok: true; message?: string; password?: string } | { ok: false; error: string };

const uuid = z.string().uuid();
const Username = z.string().trim().toLowerCase().regex(/^[a-z0-9._]{3,30}$/, 'Tên đăng nhập dài 3–30 ký tự: chữ không dấu, số, dấu chấm, gạch dưới.');
const FullName = z.string().trim().min(1, 'Nhập họ tên.').max(80, 'Họ tên quá dài.');
const Password = z.string().min(6, 'Mật khẩu cần ít nhất 6 ký tự.').max(72, 'Mật khẩu quá dài.');
const Role = z.enum(['student', 'teacher']);
const ClassId = z.union([z.literal(''), z.string().uuid()]).transform((v) => v || null);

/** Mật khẩu tạm dễ đọc (không có ký tự dễ nhầm). */
function tempPassword() {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => a[b % a.length]).join('');
}

const refresh = (id?: string) => {
  revalidatePath('/gv/hoc-sinh');
  if (id) revalidatePath(`/gv/hoc-sinh/${id}`);
  revalidatePath('/gv/lop');
};

async function usernameTaken(username: string, exceptId?: string) {
  const { data } = await supabaseAdmin().from('profiles').select('id').ilike('username', username).maybeSingle();
  return !!data && data.id !== exceptId;
}

// ---------------------------------------------------------------- thêm

const CreateSchema = z.object({
  full_name: FullName, username: Username, role: Role, class_id: ClassId,
  password: z.union([z.literal(''), Password]),
});

export async function createAccount(_: unknown, form: FormData): Promise<Res> {
  await requireTeacher();
  const parsed = CreateSchema.safeParse(Object.fromEntries(['full_name', 'username', 'role', 'class_id', 'password'].map((k) => [k, String(form.get(k) ?? '')])));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { full_name, username, role, class_id } = parsed.data;
  if (await usernameTaken(username)) return { ok: false, error: `Tên đăng nhập "${username}" đã có người dùng.` };
  const generated = !parsed.data.password;
  const password = parsed.data.password || tempPassword();
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email: usernameToEmail(username), password, email_confirm: true,
    user_metadata: { username, full_name, class_id: role === 'student' ? class_id ?? '' : '' },
  });
  if (error || !data.user) return { ok: false, error: 'Chưa tạo được tài khoản.' };
  // Trigger luôn tạo vai trò học sinh; nâng quyền / bắt đổi mật khẩu ở đây.
  await admin.from('profiles').update({ role, must_change_password: generated }).eq('id', data.user.id);
  refresh();
  return { ok: true, message: `Đã tạo tài khoản ${username}.`, password: generated ? password : undefined };
}

// ---------------------------------------------------------------- sửa

const UpdateSchema = z.object({ full_name: FullName, username: Username, role: Role, class_id: ClassId });

export async function updateAccount(id: string, _: unknown, form: FormData): Promise<Res> {
  const me = await requireTeacher();
  if (!uuid.safeParse(id).success) return { ok: false, error: 'Tài khoản không hợp lệ.' };
  const parsed = UpdateSchema.safeParse(Object.fromEntries(['full_name', 'username', 'role', 'class_id'].map((k) => [k, String(form.get(k) ?? '')])));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { full_name, username, role, class_id } = parsed.data;
  if (id === me.id && role !== 'teacher') return { ok: false, error: 'Bạn không thể tự bỏ quyền giáo viên của mình.' };

  const admin = supabaseAdmin();
  const { data: cur } = await admin.from('profiles').select('username').eq('id', id).maybeSingle();
  if (!cur) return { ok: false, error: 'Không tìm thấy tài khoản.' };
  if (username !== cur.username) {
    if (await usernameTaken(username, id)) return { ok: false, error: `Tên đăng nhập "${username}" đã có người dùng.` };
    const { error } = await admin.auth.admin.updateUserById(id, { email: usernameToEmail(username), email_confirm: true, user_metadata: { username } });
    if (error) return { ok: false, error: 'Chưa đổi được tên đăng nhập.' };
  }
  const { error } = await admin.from('profiles')
    .update({ full_name, username, role, class_id: role === 'student' ? class_id : null }).eq('id', id);
  if (error) {
    // Hoàn lại email đăng nhập nếu bước sau lỗi, để tài khoản không bị lệch.
    if (username !== cur.username) await admin.auth.admin.updateUserById(id, { email: usernameToEmail(cur.username), user_metadata: { username: cur.username } });
    return { ok: false, error: error.code === '23505' ? `Tên đăng nhập "${username}" đã có người dùng.` : 'Chưa lưu được.' };
  }
  refresh(id);
  return { ok: true, message: 'Đã lưu.' };
}

export async function setStudentClass(id: string, classId: string | null): Promise<Res> {
  await requireTeacher();
  if (!uuid.safeParse(id).success || (classId && !uuid.safeParse(classId).success)) return { ok: false, error: 'Dữ liệu không hợp lệ.' };
  const supabase = await supabaseServer();
  const { error } = await supabase.from('profiles').update({ class_id: classId }).eq('id', id).eq('role', 'student');
  if (error) return { ok: false, error: 'Chưa chuyển lớp được.' };
  refresh(id);
  return { ok: true };
}

export async function renameAccount(id: string, fullName: string): Promise<Res> {
  await requireTeacher();
  const name = FullName.safeParse(fullName);
  if (!uuid.safeParse(id).success || !name.success) return { ok: false, error: 'Họ tên không hợp lệ.' };
  const supabase = await supabaseServer();
  const { error } = await supabase.from('profiles').update({ full_name: name.data }).eq('id', id);
  if (error) return { ok: false, error: 'Chưa đổi được tên.' };
  refresh(id);
  return { ok: true };
}

// ---------------------------------------------------------------- mật khẩu, khoá

/** Đặt mật khẩu: `password` rỗng → tạo mật khẩu tạm và bắt đổi ở lần đăng nhập tới. */
export async function setPassword(id: string, password: string, mustChange: boolean): Promise<Res> {
  const me = await requireTeacher();
  if (!uuid.safeParse(id).success) return { ok: false, error: 'Tài khoản không hợp lệ.' };
  const generated = !password;
  if (!generated) { const p = Password.safeParse(password); if (!p.success) return { ok: false, error: p.error.issues[0].message }; }
  const pw = password || tempPassword();
  const admin = supabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(id, { password: pw });
  if (error) return { ok: false, error: 'Chưa đặt được mật khẩu.' };
  await admin.from('profiles').update({ must_change_password: generated || mustChange }).eq('id', id);
  if (id !== me.id) await (await supabaseServer()).rpc('revoke_sessions', { p_user: id }); // đăng xuất mọi máy
  refresh(id);
  return { ok: true, message: 'Đã đặt mật khẩu mới và đăng xuất tài khoản khỏi mọi máy.', password: generated ? pw : undefined };
}

export async function setLocked(id: string, locked: boolean): Promise<Res> {
  const me = await requireTeacher();
  if (!uuid.safeParse(id).success) return { ok: false, error: 'Tài khoản không hợp lệ.' };
  if (id === me.id) return { ok: false, error: 'Bạn không thể tự khoá tài khoản của mình.' };
  const admin = supabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: locked ? '876000h' : 'none' });
  if (error) return { ok: false, error: 'Chưa cập nhật được.' };
  await admin.from('profiles').update({ is_locked: locked }).eq('id', id);
  if (locked) await (await supabaseServer()).rpc('revoke_sessions', { p_user: id });
  refresh(id);
  return { ok: true, message: locked ? 'Đã khoá và đăng xuất mọi máy.' : 'Đã mở khoá.' };
}

// ---------------------------------------------------------------- xoá

/** Xoá hẳn tài khoản cùng mọi bài làm của tài khoản đó. */
export async function deleteAccount(id: string): Promise<Res> {
  const me = await requireTeacher();
  if (!uuid.safeParse(id).success) return { ok: false, error: 'Tài khoản không hợp lệ.' };
  if (id === me.id) return { ok: false, error: 'Bạn không thể tự xoá tài khoản của mình.' };
  const { error } = await supabaseAdmin().auth.admin.deleteUser(id);
  if (error) return { ok: false, error: 'Chưa xoá được tài khoản.' };
  refresh();
  redirect('/gv/hoc-sinh');
}

/** Xoá một bài làm (học sinh được làm lại nếu bài giao còn mở). */
export async function deleteAttempt(attemptId: string, back?: string): Promise<Res> {
  await requireTeacher();
  if (!uuid.safeParse(attemptId).success) return { ok: false, error: 'Bài làm không hợp lệ.' };
  const supabase = await supabaseServer();
  const { data: t } = await supabase.from('attempts').select('student_id, assignment_id').eq('id', attemptId).maybeSingle();
  if (!t) return { ok: false, error: 'Không tìm thấy bài làm.' };
  const { error } = await supabase.from('attempts').delete().eq('id', attemptId);
  if (error) return { ok: false, error: 'Chưa xoá được bài làm.' };
  refresh(t.student_id);
  revalidatePath(`/gv/bai-giao/${t.assignment_id}`);
  revalidatePath('/gv');
  if (back?.startsWith('/gv/')) redirect(back);
  return { ok: true, message: 'Đã xoá bài làm.' };
}
