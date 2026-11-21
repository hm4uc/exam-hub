'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { zodFieldErrors } from '@/lib/validation';
import { homePathFor, type UserRole } from '@/server/auth';
import { supabaseAdmin } from '@/server/supabase/admin';
import { usernameToEmail } from '@/server/supabase/env';
import { supabaseServer } from '@/server/supabase/server';
import { recordTrace } from '@/server/trace';

export type FormState = { error?: string; fieldErrors?: Record<string, string>; fields?: Record<string, string> } | undefined;

const USERNAME = /^[a-z0-9._]{3,30}$/;
const safeNext = (n: FormDataEntryValue | null) => {
  const s = typeof n === 'string' ? n : '';
  return s.startsWith('/') && !s.startsWith('//') ? s : '';
};

async function currentProfile() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) return null;
  const { data: p } = await supabase.from('profiles').select('id, role, username, must_change_password').eq('id', uid).maybeSingle();
  return p as { id: string; role: UserRole; username: string; must_change_password: boolean } | null;
}

async function homeFor(next: string) {
  if (next) return next;
  const p = await currentProfile();
  return p ? homePathFor(p.role) : '/';
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const username = String(form.get('username') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  const next = safeNext(form.get('next'));
  const fields = { username };
  const fieldErrors: Record<string, string> = {};
  if (!username) fieldErrors.username = 'Vui lòng nhập tên đăng nhập.';
  if (!password) fieldErrors.password = 'Vui lòng nhập mật khẩu.';
  if (Object.keys(fieldErrors).length) {
    return { error: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.', fieldErrors, fields };
  }
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
  if (error) {
    const locked = /banned/i.test(error.message);
    void recordTrace({
      level: 'warn',
      category: 'auth',
      event: 'auth_login_failed',
      username,
      path: '/dang-nhap',
      message: locked ? 'Tài khoản bị khoá' : 'Sai tên đăng nhập hoặc mật khẩu',
    });
    if (locked) {
      return {
        error: 'Tài khoản đang bị khoá. Hãy báo giáo viên.',
        fieldErrors: { username: 'Tài khoản này hiện đang bị khoá.' },
        fields,
      };
    }
    return {
      error: 'Sai tên đăng nhập hoặc mật khẩu. Quên mật khẩu thì nhờ giáo viên đặt lại.',
      fieldErrors: { username: 'Kiểm tra lại tên đăng nhập.', password: 'Hoặc mật khẩu chưa đúng.' },
      fields,
    };
  }
  const p = await currentProfile();
  void recordTrace({
    level: 'info',
    category: 'auth',
    event: 'auth_login_ok',
    user_id: p?.id ?? null,
    username: p?.username ?? username,
    path: '/dang-nhap',
    meta: { role: p?.role, next: next || null, must_change_password: !!p?.must_change_password },
  });
  if (p?.must_change_password) {
    redirect(`/doi-mat-khau${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  }
  redirect(next || (p ? homePathFor(p.role) : '/'));
}

const RegisterSchema = z
  .object({
    full_name: z.string().trim().min(2, 'Nhập họ và tên đầy đủ.').max(80, 'Họ tên quá dài.'),
    username: z.string().trim().toLowerCase().regex(USERNAME, 'Tên đăng nhập dài 3–30 ký tự, chỉ gồm chữ không dấu, số, dấu chấm hoặc gạch dưới.'),
    password: z.string().min(6, 'Mật khẩu cần ít nhất 6 ký tự.').max(72, 'Mật khẩu quá dài.'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: 'Hai lần nhập mật khẩu chưa khớp.', path: ['confirm'] });

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const raw = Object.fromEntries(['full_name', 'username', 'password', 'confirm'].map((k) => [k, String(form.get(k) ?? '')]));
  const fields = { full_name: raw.full_name, username: raw.username };
  const parsed = RegisterSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message, fieldErrors: zodFieldErrors(parsed.error), fields };
  const { full_name, username, password } = parsed.data;
  const next = safeNext(form.get('next'));
  const admin = supabaseAdmin();

  const { data: taken } = await admin.from('profiles').select('id').ilike('username', username).maybeSingle();
  if (taken) {
    return {
      error: `Tên đăng nhập "${username}" đã có người dùng. Hãy chọn tên khác.`,
      fieldErrors: { username: `Tên "${username}" đã có người dùng.` },
      fields,
    };
  }

  // Đăng ký qua link Bài giao → xếp tạm vào lớp của Bài giao đó (nếu bài giao có gắn lớp).
  let class_id = '';
  const code = next.match(/^\/([a-z2-9]{6})(?:\/|$)/i)?.[1]?.toLowerCase();
  if (code) {
    const { data: a } = await admin.from('assignments').select('class_id').eq('code', code).maybeSingle();
    class_id = a?.class_id ?? '';
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
    user_metadata: { username, full_name, class_id },
  });
  if (error) {
    void recordTrace({ level: 'warn', category: 'auth', event: 'auth_register_failed', username, path: '/dang-ky', message: error.message });
    const dup = /already/i.test(error.message);
    return {
      error: dup ? `Tên đăng nhập "${username}" đã có người dùng.` : 'Chưa tạo được tài khoản. Hãy thử lại.',
      ...(dup ? { fieldErrors: { username: `Tên "${username}" đã có người dùng.` } } : {}),
      fields,
    };
  }

  const supabase = await supabaseServer();
  await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
  void recordTrace({
    level: 'info',
    category: 'auth',
    event: 'auth_register_ok',
    user_id: created.user?.id ?? null,
    username,
    assignment_code: code ?? null,
    path: '/dang-ky',
    meta: { full_name, class_id: class_id || null },
  });
  redirect(next || '/');
}

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const password = String(form.get('password') ?? '');
  const confirm = String(form.get('confirm') ?? '');
  const next = safeNext(form.get('next'));
  const fieldErrors: Record<string, string> = {};
  if (!password) fieldErrors.password = 'Vui lòng nhập mật khẩu mới.';
  else if (password.length < 6) fieldErrors.password = 'Mật khẩu cần ít nhất 6 ký tự.';
  else if (password.length > 72) fieldErrors.password = 'Mật khẩu tối đa 72 ký tự.';
  if (!confirm) fieldErrors.confirm = 'Vui lòng nhập lại mật khẩu mới.';
  else if (password !== confirm) fieldErrors.confirm = 'Hai lần nhập mật khẩu chưa khớp.';
  if (Object.keys(fieldErrors).length) {
    return { error: Object.values(fieldErrors)[0], fieldErrors };
  }
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const same = /different|same/i.test(error.message);
    const msg = same ? 'Mật khẩu mới phải khác mật khẩu cũ.' : 'Chưa đổi được mật khẩu. Hãy thử lại.';
    return { error: msg, ...(same ? { fieldErrors: { password: msg } } : {}) };
  }
  await supabase.rpc('clear_must_change_password');
  const p = await currentProfile();
  void recordTrace({ level: 'info', category: 'auth', event: 'auth_password_changed', user_id: p?.id ?? null, username: p?.username ?? null, path: '/doi-mat-khau' });
  redirect(await homeFor(next));
}

/** Bỏ qua lời nhắc đổi mật khẩu tạm và giữ nguyên mật khẩu hiện tại. */
export async function skipPasswordChange(form: FormData) {
  const next = safeNext(form.get('next'));
  const supabase = await supabaseServer();
  const p = await currentProfile();
  await supabase.rpc('clear_must_change_password');
  void recordTrace({ level: 'info', category: 'auth', event: 'auth_password_skip', user_id: p?.id ?? null, username: p?.username ?? null, path: '/doi-mat-khau' });
  redirect(await homeFor(next));
}

export async function signOut() {
  const supabase = await supabaseServer();
  const p = await currentProfile();
  await supabase.auth.signOut({ scope: 'local' });
  void recordTrace({ level: 'info', category: 'auth', event: 'auth_logout', user_id: p?.id ?? null, username: p?.username ?? null });
  redirect('/dang-nhap');
}
