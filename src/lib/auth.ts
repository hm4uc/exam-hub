import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { supabaseServer } from './supabase/server';

export interface Me {
  id: string;
  role: 'teacher' | 'student';
  username: string;
  full_name: string;
  class_id: string | null;
  is_locked: boolean;
  must_change_password: boolean;
}

/** Người dùng hiện tại (một lần mỗi request). null nếu chưa đăng nhập. */
export const getMe = cache(async (): Promise<Me | null> => {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) return null;
  const { data: p } = await supabase
    .from('profiles')
    .select('id, role, username, full_name, class_id, is_locked, must_change_password')
    .eq('id', uid)
    .maybeSingle();
  return (p as Me) ?? null;
});

async function requireUser(): Promise<Me> {
  const me = await getMe();
  if (!me) redirect('/dang-nhap');
  if (me.is_locked) redirect('/dang-nhap?locked=1');
  if (me.must_change_password) redirect('/doi-mat-khau?bat-buoc=1');
  return me;
}

export async function requireTeacher(): Promise<Me> {
  const me = await requireUser();
  if (me.role !== 'teacher') redirect('/');
  return me;
}

export async function requireStudent(): Promise<Me> {
  const me = await requireUser();
  if (me.role !== 'student') redirect('/gv');
  return me;
}

export { RPC_MESSAGES as RPC_ERRORS, rpcMessage } from './rpc-messages';
