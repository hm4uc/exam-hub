'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/server/auth';
import { supabaseServer } from '@/server/supabase/server';
import { recordTrace } from '@/server/trace';

export async function purgeOldTraces(days = 7): Promise<{ ok: true; deleted: number } | { ok: false; error: string }> {
  const me = await requireAdmin();
  const safeDays = Math.max(1, Math.min(365, Math.floor(days)));
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc('purge_old_traces', { p_days: safeDays });
  if (error) return { ok: false, error: 'Chưa dọn được nhật ký cũ.' };
  const deleted = typeof data === 'number' ? data : 0;
  void recordTrace({
    level: 'info',
    category: 'admin',
    event: 'traces_purged',
    user_id: me.id,
    username: me.username,
    path: '/admin',
    message: `Đã dọn ${deleted} dòng log cũ hơn ${safeDays} ngày`,
    meta: { days: safeDays, deleted },
  });
  revalidatePath('/admin');
  return { ok: true, deleted };
}
