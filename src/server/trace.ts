import 'server-only';
import { headers } from 'next/headers';
import { supabaseAdmin } from '@/server/supabase/admin';
import type { TraceCategory, TraceLevel } from '@/lib/trace-types';

export interface ServerTraceInput {
  level?: TraceLevel;
  category: TraceCategory;
  event: string;
  message?: string | null;
  path?: string | null;
  user_id?: string | null;
  username?: string | null;
  guest_key?: string | null;
  attempt_id?: string | null;
  assignment_code?: string | null;
  session_id?: string | null;
  meta?: Record<string, unknown>;
}

/** Ghi sự kiện trace phía server (không làm chậm hay làm lỗi luồng chính). */
export async function recordTrace(input: ServerTraceInput) {
  try {
    let ua: string | null = 'server';
    try {
      const h = await headers();
      ua = h.get('user-agent')?.slice(0, 300) ?? 'server';
    } catch { /* ngoài request context */ }

    const admin = supabaseAdmin();
    await admin.from('trace_events').insert({
      level: input.level ?? 'info',
      category: input.category,
      event: input.event.slice(0, 80),
      message: input.message ? input.message.slice(0, 500) : null,
      path: input.path ? input.path.slice(0, 300) : null,
      user_id: input.user_id ?? null,
      username: input.username ?? null,
      guest_key: input.guest_key ? input.guest_key.slice(0, 120) : null,
      attempt_id: input.attempt_id ?? null,
      assignment_code: input.assignment_code ? input.assignment_code.toLowerCase().slice(0, 20) : null,
      session_id: input.session_id ? input.session_id.slice(0, 64) : null,
      meta: input.meta ?? {},
      user_agent: ua,
    });
  } catch { /* bỏ qua lỗi trace */ }
}
