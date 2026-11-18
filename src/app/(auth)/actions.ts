'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { usernameToEmail } from '@/lib/supabase/env';
import { supabaseServer } from '@/lib/supabase/server';

export type FormState = { error?: string; fields?: Record<string, string> } | undefined;

const USERNAME = /^[a-z0-9._]{3,30}$/;
const safeNext = (n: FormDataEntryValue | null) => {
  const s = typeof n === 'string' ? n : '';
  return s.startsWith('/') && !s.startsWith('//') ? s : '';
};

async function homeFor(next: string) {
  if (next) return next;
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const { data: p } = await supabase.from('profiles').select('role').eq('id', data?.claims?.sub ?? '').maybeSingle();
  return p?.role === 'teacher' ? '/gv' : '/';
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const username = String(form.get('username') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  const fields = { username };
  if (!username || !password) return { error: 'Nhập tên đăng nhập và mật khẩu.', fields };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
  if (error) {
    if (/banned/i.test(error.message)) return { error: 'Tài khoản đang bị khoá. Hãy báo giáo viên.', fields };
    return { error: 'Sai tên đăng nhập hoặc mật khẩu. Quên mật khẩu thì nhờ giáo viên đặt lại.', fields };
  }
  redirect(await homeFor(safeNext(form.get('next'))));
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
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  const { full_name, username, password } = parsed.data;
  const next = safeNext(form.get('next'));
  const admin = supabaseAdmin();

  const { data: taken } = await admin.from('profiles').select('id').ilike('username', username).maybeSingle();
  if (taken) return { error: `Tên đăng nhập "${username}" đã có người dùng. Hãy chọn tên khác.`, fields };

  // Đăng ký qua link Bài giao → xếp tạm vào lớp của Bài giao đó.
  let class_id = '';
  const code = next.match(/^\/([a-z2-9]{6})(?:\/|$)/)?.[1];
  if (code) {
    const { data: a } = await admin.from('assignments').select('class_id').eq('code', code).maybeSingle();
    class_id = a?.class_id ?? '';
  }

  const { error } = await admin.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
    user_metadata: { username, full_name, class_id },
  });
  if (error) return { error: /already/i.test(error.message) ? `Tên đăng nhập "${username}" đã có người dùng.` : 'Chưa tạo được tài khoản. Hãy thử lại.', fields };

  const supabase = await supabaseServer();
  await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
  redirect(next || '/');
}

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const password = String(form.get('password') ?? '');
  const confirm = String(form.get('confirm') ?? '');
  if (password.length < 6) return { error: 'Mật khẩu cần ít nhất 6 ký tự.' };
  if (password !== confirm) return { error: 'Hai lần nhập mật khẩu chưa khớp.' };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: /different|same/i.test(error.message) ? 'Mật khẩu mới phải khác mật khẩu cũ.' : 'Chưa đổi được mật khẩu. Hãy thử lại.' };
  await supabase.rpc('clear_must_change_password');
  redirect(await homeFor(''));
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/dang-nhap');
}
