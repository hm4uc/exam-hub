import 'server-only';
import { supabaseAdmin } from '@/server/supabase/admin';

export interface AssignmentOwner { owner_id: string; class_id: string | null; teacher_code: string | null }

/** Giáo viên sở hữu bài giao theo mã link (đọc bằng service role vì người gọi có thể chưa đăng nhập). */
export async function assignmentOwner(code: string): Promise<AssignmentOwner | null> {
  const admin = supabaseAdmin();
  const { data: a } = await admin.from('assignments').select('owner_id, class_id').eq('code', code.toLowerCase()).maybeSingle();
  if (!a?.owner_id) return null;
  const { data: o } = await admin.from('profiles').select('teacher_code').eq('id', a.owner_id).maybeSingle();
  return { owner_id: a.owner_id, class_id: a.class_id ?? null, teacher_code: o?.teacher_code ?? null };
}
