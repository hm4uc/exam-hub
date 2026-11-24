import 'server-only';
import { createHash } from 'node:crypto';
import { supabaseAdmin } from '@/server/supabase/admin';

/** Khoá giới hạn theo IP (đã băm, không lưu IP thô). Vercel đặt x-forwarded-for; mục đầu tiên là client. */
export function clientKey(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = fwd || request.headers.get('x-real-ip') || 'unknown';
  return createHash('sha256').update(ip).digest('hex').slice(0, 24);
}

/**
 * true = được phép; false = vượt hạn mức. Cửa sổ cố định, đếm trong Postgres (dùng chung mọi instance).
 * Nếu CSDL lỗi hoặc chưa chạy migration: cho qua (fail-open) và ghi log, để lỗi hạ tầng không chặn người dùng thật.
 */
export async function rateLimit(key: string, opts: { windowSeconds: number; limit: number }): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin().rpc('rate_limit_hit', {
      p_key: key, p_window_seconds: opts.windowSeconds, p_limit: opts.limit,
    });
    if (error) { console.error('rate_limit_hit lỗi:', error.message); return true; }
    return data === true;
  } catch (e) {
    console.error('rate_limit_hit lỗi:', (e as Error).message);
    return true;
  }
}

/** Như clientKey nhưng dùng trong Server Action (chỉ có headers()). */
export function clientKeyFromHeaders(h: Headers): string {
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
  return createHash('sha256').update(ip).digest('hex').slice(0, 24);
}
