import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { supabaseServer } from '@/server/supabase/server';

export type UserRole = 'admin' | 'teacher' | 'student';

export interface Me {
  id: string;
  role: UserRole;
  username: string;
  full_name: string;
  class_id: string | null;
  teacher_code: string | null;
  is_locked: boolean;
  must_change_password: boolean;
  class_name: string | null;
}

/** Người dùng hiện tại (một lần mỗi request). null nếu chưa đăng nhập. */
export const getMe = cache(async (): Promise<Me | null> => {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) return null;
  const { data: p } = await supabase
    .from('profiles')
    .select('id, role, username, full_name, class_id, teacher_code, is_locked, must_change_password, classes!profiles_class_id_fkey(name)')
    .eq('id', uid)
    .maybeSingle();
  if (!p) return null;
  const { classes, ...rest } = p as typeof p & { classes: { name: string } | null };
  return { ...rest, class_name: classes?.name ?? null } as Me;
});

async function requireUser(): Promise<Me> {
  const me = await getMe();
  if (!me) redirect('/dang-nhap');
  if (me.is_locked) redirect('/dang-nhap?locked=1');
  return me;
}

export async function requireAdmin(): Promise<Me> {
  const me = await requireUser();
  if (me.role !== 'admin') redirect(me.role === 'teacher' ? '/gv' : '/');
  return me;
}

export async function requireTeacher(): Promise<Me> {
  const me = await requireUser();
  if (me.role !== 'teacher' && me.role !== 'admin') redirect('/');
  return me;
}

export async function requireStudent(): Promise<Me> {
  const me = await requireUser();
  if (me.role === 'admin') redirect('/admin');
  if (me.role !== 'student') redirect('/gv');
  return me;
}

export function homePathFor(role: UserRole): string {
  if (role === 'admin') return '/admin';
  if (role === 'teacher') return '/gv';
  return '/';
}

export { RPC_MESSAGES as RPC_ERRORS, rpcMessage } from '@/lib/rpc-messages';
