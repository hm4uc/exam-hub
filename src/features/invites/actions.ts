'use server';
// Mã mời giáo viên: quản trị viên tạo/xoá mã; người có mã tự đăng ký tài khoản giáo viên.
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { teacherCodeBase } from '@/domain/tenant';
import { zodFieldErrors } from '@/lib/validation';
import type { FormState } from '@/features/auth/actions';
import { requireAdmin } from '@/server/auth';
import { clientKeyFromHeaders, rateLimit } from '@/server/rate-limit';
import { supabaseAdmin } from '@/server/supabase/admin';
import { usernameToEmail } from '@/server/supabase/env';
import { supabaseServer } from '@/server/supabase/server';
import { recordTrace } from '@/server/trace';

export type InviteRes = { ok: true; message?: string } | { ok: false; error: string };

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => ALPHABET[b % ALPHABET.length]).join('');

const InviteSchema = z.object({
  note: z.string().trim().max(120, 'Ghi chú tối đa 120 ký tự.'),
  max_uses: z.coerce.number().int().min(1, 'Số lượt từ 1 đến 100.').max(100, 'Số lượt từ 1 đến 100.'),
  days: z.coerce.number().int().min(0).max(365, 'Hạn tối đa 365 ngày.'),
});

export async function createInvite(_: unknown, form: FormData): Promise<InviteRes> {
  const me = await requireAdmin();
  const parsed = InviteSchema.safeParse({ note: form.get('note') ?? '', max_uses: form.get('max_uses') ?? 1, days: form.get('days') ?? 0 });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { note, max_uses, days } = parsed.data;
  const supabase = await supabaseServer();
  const { error } = await supabase.from('teacher_invites').insert({
    code: newCode(),
    note: note || null,
    max_uses,
    expires_at: days ? new Date(Date.now() + days * 86400_000).toISOString() : null,
    created_by: me.id,
  });
  if (error) return { ok: false, error: 'Chưa tạo được mã mời. Hãy thử lại.' };
  revalidatePath('/admin/giao-vien');
  return { ok: true, message: 'Đã tạo mã mời.' };
}

export async function deleteInvite(code: string): Promise<InviteRes> {
  await requireAdmin();
  const supabase = await supabaseServer();
  const { error } = await supabase.from('teacher_invites').delete().eq('code', code);
  if (error) return { ok: false, error: 'Chưa xoá được mã.' };
  revalidatePath('/admin/giao-vien');
  return { ok: true };
}

// ---------------------------------------------------------------- đăng ký giáo viên bằng mã mời

const TeacherSchema = z
  .object({
    invite: z.string().trim().toLowerCase().regex(/^[a-z2-9]{10}$/, 'Mã mời gồm 10 ký tự.'),
    full_name: z.string().trim().min(2, 'Nhập họ và tên đầy đủ.').max(80, 'Họ tên quá dài.'),
    username: z.string().trim().toLowerCase().regex(/^[a-z0-9._]{3,30}$/, 'Tên đăng nhập dài 3–30 ký tự, chỉ gồm chữ không dấu, số, dấu chấm hoặc gạch dưới.'),
    password: z.string().min(6, 'Mật khẩu cần ít nhất 6 ký tự.').max(72, 'Mật khẩu quá dài.'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: 'Hai lần nhập mật khẩu chưa khớp.', path: ['confirm'] });

export async function registerTeacher(_: FormState, form: FormData): Promise<FormState> {
  const raw = Object.fromEntries(['invite', 'full_name', 'username', 'password', 'confirm'].map((k) => [k, String(form.get(k) ?? '')]));
  const fields = { invite: raw.invite, full_name: raw.full_name, username: raw.username };
  const parsed = TeacherSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message, fieldErrors: zodFieldErrors(parsed.error), fields };
  const { invite, full_name, username, password } = parsed.data;

  if (!(await rateLimit(`reg-teacher:${clientKeyFromHeaders(await headers())}`, { windowSeconds: 600, limit: 10 }))) {
    return { error: 'Bạn đã thử quá nhiều lần. Hãy đợi vài phút rồi thử lại.', fields };
  }
  const admin = supabaseAdmin();
  const { data: taken } = await admin.from('profiles').select('id').ilike('username', username).maybeSingle();
  if (taken) {
    const msg = `Tên đăng nhập "${username}" đã có người dùng.`;
    return { error: msg, fieldErrors: { username: msg }, fields };
  }

  // Giữ một lượt của mã mời (nguyên tử); mọi lỗi phía sau phải hoàn lại lượt.
  const { data: ok } = await admin.rpc('use_teacher_invite', { p_code: invite });
  if (ok !== true) {
    const msg = 'Mã mời không đúng, đã hết hạn hoặc đã hết lượt dùng.';
    void recordTrace({ level: 'warn', category: 'auth', event: 'teacher_register_bad_invite', username, path: '/dang-ky-giao-vien', message: msg });
    return { error: msg, fieldErrors: { invite: msg }, fields };
  }
  const release = () => admin.rpc('release_teacher_invite', { p_code: invite });

  // Mã giáo viên (tiền tố tên đăng nhập học sinh) suy từ tên đăng nhập, thêm số đuôi nếu trùng.
  const base = teacherCodeBase(username);
  let teacherCode = base;
  for (let i = 2; i < 100; i++) {
    const { data: dup } = await admin.from('profiles').select('id').eq('teacher_code', teacherCode).maybeSingle();
    if (!dup) break;
    teacherCode = `${base}${i}`.slice(0, 12);
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email: usernameToEmail(username), password, email_confirm: true,
    user_metadata: { username, full_name, teacher_code: teacherCode },
  });
  if (error || !created.user) {
    await release();
    return { error: 'Chưa tạo được tài khoản. Hãy thử lại.', fields };
  }
  const { error: roleErr } = await admin.from('profiles').update({ role: 'teacher' }).eq('id', created.user.id);
  if (roleErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    await release();
    return { error: 'Chưa tạo được tài khoản. Hãy thử lại.', fields };
  }

  const supabase = await supabaseServer();
  await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
  void recordTrace({
    level: 'info', category: 'auth', event: 'teacher_register_ok', user_id: created.user.id, username,
    path: '/dang-ky-giao-vien', meta: { teacher_code: teacherCode },
  });
  redirect('/gv');
}
