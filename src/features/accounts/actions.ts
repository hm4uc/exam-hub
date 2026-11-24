'use server';
// Quản lý tài khoản: giáo viên (admin) có toàn quyền thêm / sửa / xoá mọi tài khoản và bài làm.
// Thao tác trên auth.users dùng service role, luôn sau requireTeacher(). Không cho tự xoá / tự khoá / tự hạ quyền.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { TEACHER_CODE_RE, maxLocalLength, withTeacherPrefix } from '@/domain/tenant';
import { zodFieldErrors } from '@/lib/validation';
import { requireTeacher, type Me } from '@/server/auth';
import { supabaseAdmin } from '@/server/supabase/admin';
import { usernameToEmail } from '@/server/supabase/env';
import { supabaseServer } from '@/server/supabase/server';
import { recordTrace } from '@/server/trace';

export type Res = { ok: true; message?: string; password?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

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

/** Tài khoản đích mà người dùng hiện tại được quản lý: admin → bất kỳ; giáo viên → chỉ học sinh của mình. */
async function loadTarget(me: Me, id: string) {
  const { data } = await supabaseAdmin().from('profiles').select('id, username, role, owner_id, class_id').eq('id', id).maybeSingle();
  if (!data) return null;
  if (me.role === 'admin') return data;
  return data.role === 'student' && data.owner_id === me.id ? data : null;
}

async function teacherCodeOf(ownerId: string | null) {
  if (!ownerId) return null;
  const { data } = await supabaseAdmin().from('profiles').select('teacher_code').eq('id', ownerId).maybeSingle();
  return data?.teacher_code ?? null;
}

async function usernameTaken(username: string, exceptId?: string) {
  const { data } = await supabaseAdmin().from('profiles').select('id').ilike('username', username).maybeSingle();
  return !!data && data.id !== exceptId;
}

// ---------------------------------------------------------------- thêm

const TeacherCode = z.string().trim().toLowerCase().regex(TEACHER_CODE_RE, 'Mã giáo viên gồm 2–12 ký tự chữ không dấu hoặc số.');
const CreateSchema = z.object({
  full_name: FullName, username: Username, role: Role, class_id: ClassId,
  password: z.union([z.literal(''), Password]),
});

export async function createAccount(_: unknown, form: FormData): Promise<Res> {
  const me = await requireTeacher();
  const parsed = CreateSchema.safeParse(Object.fromEntries(['full_name', 'username', 'role', 'class_id', 'password'].map((k) => [k, String(form.get(k) ?? '')])));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message, fieldErrors: zodFieldErrors(parsed.error) };
  const { full_name, role, class_id } = parsed.data;
  if (role === 'teacher' && me.role !== 'admin') return { ok: false, error: 'Chỉ quản trị viên mới tạo được tài khoản giáo viên.', fieldErrors: { role: 'Chỉ quản trị viên tạo được giáo viên.' } };
  let teacherCode = '';
  if (role === 'teacher') {
    const tc = TeacherCode.safeParse(String(form.get('teacher_code') ?? ''));
    if (!tc.success) return { ok: false, error: tc.error.issues[0].message, fieldErrors: { teacher_code: tc.error.issues[0].message } };
    teacherCode = tc.data;
  }
  // Học sinh của giáo viên có mã "gva" đăng nhập bằng "gva.<tên>".
  const username = role === 'student' ? withTeacherPrefix(me.teacher_code, parsed.data.username) : parsed.data.username;
  if (role === 'student' && parsed.data.username.length > maxLocalLength(me.teacher_code)) {
    const msg = `Tên đăng nhập tối đa ${maxLocalLength(me.teacher_code)} ký tự.`;
    return { ok: false, error: msg, fieldErrors: { username: msg } };
  }
  if (await usernameTaken(username)) {
    const msg = `Tên đăng nhập "${username}" đã có người dùng.`;
    return { ok: false, error: msg, fieldErrors: { username: msg } };
  }
  if (teacherCode) {
    const { data: dupCode } = await supabaseAdmin().from('profiles').select('id').eq('teacher_code', teacherCode).maybeSingle();
    if (dupCode) return { ok: false, error: 'Mã giáo viên này đã được dùng.', fieldErrors: { teacher_code: 'Mã này đã được dùng.' } };
  }
  const generated = !parsed.data.password;
  const password = parsed.data.password || tempPassword();
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email: usernameToEmail(username), password, email_confirm: true,
    user_metadata: {
      username, full_name,
      class_id: role === 'student' ? class_id ?? '' : '',
      owner_id: role === 'student' ? me.id : '',
      teacher_code: teacherCode,
    },
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
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message, fieldErrors: zodFieldErrors(parsed.error) };
  const { full_name, username: parsedUsername, role, class_id } = parsed.data;
  if (id === me.id && role !== 'teacher') return { ok: false, error: 'Bạn không thể tự bỏ quyền giáo viên của mình.', fieldErrors: { role: 'Không thể tự bỏ quyền giáo viên.' } };

  const admin = supabaseAdmin();
  const cur = await loadTarget(me, id);
  if (!cur) return { ok: false, error: 'Không tìm thấy tài khoản.' };
  // Chỉ quản trị viên được đổi vai trò; giáo viên chỉ sửa học sinh của mình.
  const nextRole = cur.role === 'admin' ? 'admin' : me.role === 'admin' ? role : 'student';
  const username = nextRole === 'student' ? withTeacherPrefix(await teacherCodeOf(cur.owner_id), parsedUsername) : parsedUsername;
  if (username !== cur.username) {
    if (await usernameTaken(username, id)) {
      const msg = `Tên đăng nhập "${username}" đã có người dùng.`;
      return { ok: false, error: msg, fieldErrors: { username: msg } };
    }
    const { error } = await admin.auth.admin.updateUserById(id, { email: usernameToEmail(username), email_confirm: true, user_metadata: { username } });
    if (error) return { ok: false, error: 'Chưa đổi được tên đăng nhập.' };
  }
  const { error } = await admin.from('profiles')
    .update({ full_name, username, role: nextRole, class_id: nextRole === 'student' ? class_id : null }).eq('id', id);
  if (error) {
    // Hoàn lại email đăng nhập nếu bước sau lỗi, để tài khoản không bị lệch.
    if (username !== cur.username) await admin.auth.admin.updateUserById(id, { email: usernameToEmail(cur.username), user_metadata: { username: cur.username } });
    const dup = error.code === '23505';
    const msg = dup ? `Tên đăng nhập "${username}" đã có người dùng.` : 'Chưa lưu được.';
    return { ok: false, error: msg, ...(dup ? { fieldErrors: { username: msg } } : {}) };
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
  if (!uuid.safeParse(id).success) return { ok: false, error: 'Tài khoản không hợp lệ.' };
  const name = FullName.safeParse(fullName);
  if (!name.success) {
    const msg = name.error.issues[0].message;
    return { ok: false, error: msg, fieldErrors: { full_name: msg } };
  }
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
  if (!generated) {
    const p = Password.safeParse(password);
    if (!p.success) {
      const msg = p.error.issues[0].message;
      return { ok: false, error: msg, fieldErrors: { password: msg } };
    }
  }
  if (!(await loadTarget(me, id))) return { ok: false, error: 'Không tìm thấy tài khoản.' };
  const pw = password || tempPassword();
  const admin = supabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(id, { password: pw });
  if (error) return { ok: false, error: 'Chưa đặt được mật khẩu.' };
  const { data: target } = await admin.from('profiles').select('username').eq('id', id).maybeSingle();
  await admin.from('profiles').update({ must_change_password: generated || mustChange }).eq('id', id);
  if (id !== me.id) await (await supabaseServer()).rpc('revoke_sessions', { p_user: id }); // đăng xuất mọi máy
  void recordTrace({
    level: 'warn',
    category: 'auth',
    event: 'admin_password_reset_revoke',
    user_id: id,
    username: target?.username ?? null,
    path: `/gv/hoc-sinh/${id}`,
    message: `${me.username} đặt lại mật khẩu${id !== me.id ? ' và đăng xuất mọi thiết bị' : ''}`,
    meta: { by: me.username, generated, mustChange: generated || mustChange, revoked: id !== me.id },
  });
  refresh(id);
  return { ok: true, message: 'Đã đặt mật khẩu mới và đăng xuất tài khoản khỏi mọi máy.', password: generated ? pw : undefined };
}

export async function setLocked(id: string, locked: boolean): Promise<Res> {
  const me = await requireTeacher();
  if (!uuid.safeParse(id).success) return { ok: false, error: 'Tài khoản không hợp lệ.' };
  if (id === me.id) return { ok: false, error: 'Bạn không thể tự khoá tài khoản của mình.' };
  const admin = supabaseAdmin();
  const target = await loadTarget(me, id);
  if (!target) return { ok: false, error: 'Không tìm thấy tài khoản.' };
  if (target.role === 'admin' && me.role !== 'admin') return { ok: false, error: 'Không thể khoá tài khoản quản trị.' };
  const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: locked ? '876000h' : 'none' });
  if (error) return { ok: false, error: 'Chưa cập nhật được.' };
  await admin.from('profiles').update({ is_locked: locked }).eq('id', id);
  if (locked) await (await supabaseServer()).rpc('revoke_sessions', { p_user: id });
  void recordTrace({
    level: 'warn',
    category: 'auth',
    event: 'admin_account_locked',
    user_id: id,
    username: target?.username ?? null,
    path: `/gv/hoc-sinh/${id}`,
    message: locked ? `${me.username} đã khoá tài khoản` : `${me.username} đã mở khoá tài khoản`,
    meta: { by: me.username, locked },
  });
  refresh(id);
  return { ok: true, message: locked ? 'Đã khoá và đăng xuất mọi máy.' : 'Đã mở khoá.' };
}

// ---------------------------------------------------------------- xoá

/** Xoá hẳn tài khoản cùng mọi bài làm của tài khoản đó. */
export async function deleteAccount(id: string): Promise<Res> {
  const me = await requireTeacher();
  if (!uuid.safeParse(id).success) return { ok: false, error: 'Tài khoản không hợp lệ.' };
  if (id === me.id) return { ok: false, error: 'Bạn không thể tự xoá tài khoản của mình.' };
  const target = await loadTarget(me, id);
  if (!target) return { ok: false, error: 'Không tìm thấy tài khoản.' };
  if (target.role === 'admin' && me.role !== 'admin') return { ok: false, error: 'Không thể xoá tài khoản quản trị.' };
  const { error } = await supabaseAdmin().auth.admin.deleteUser(id);
  if (error) return { ok: false, error: 'Chưa xoá được tài khoản.' };
  refresh();
  redirect('/gv/hoc-sinh');
}

/** Xoá một bài làm (học sinh được làm lại nếu bài giao còn mở). */
export async function deleteAttempt(attemptId: string, back?: string): Promise<Res> {
  const me = await requireTeacher();
  if (!uuid.safeParse(attemptId).success) return { ok: false, error: 'Bài làm không hợp lệ.' };
  const supabase = await supabaseServer();
  const { data: t } = await supabase.from('attempts').select('student_id, guest_name, assignment_id').eq('id', attemptId).maybeSingle();
  if (!t) return { ok: false, error: 'Không tìm thấy bài làm.' };
  const { error } = await supabase.from('attempts').delete().eq('id', attemptId);
  if (error) return { ok: false, error: 'Chưa xoá được bài làm.' };
  void recordTrace({
    level: 'info',
    category: 'admin',
    event: 'attempt_deleted',
    user_id: me.id,
    username: me.username,
    attempt_id: attemptId,
    message: `Xoá bài làm của ${t.guest_name || 'học sinh'}`,
    meta: { assignment_id: t.assignment_id, student_id: t.student_id },
  });
  refresh(t.student_id ?? undefined);
  revalidatePath(`/gv/bai-giao/${t.assignment_id}`);
  revalidatePath('/gv');
  if (back?.startsWith('/gv/')) redirect(back);
  return { ok: true, message: 'Đã xoá bài làm.' };
}
