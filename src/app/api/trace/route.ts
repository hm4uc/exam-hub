import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/server/supabase/admin';
import { supabaseServer } from '@/server/supabase/server';

const EventSchema = z.object({
  level: z.enum(['info', 'warn', 'error']).default('info'),
  category: z.enum(['auth', 'exam', 'nav', 'error', 'network', 'admin']),
  event: z.string().trim().min(1).max(80),
  message: z.string().max(500).optional(),
  path: z.string().max(300).optional(),
  guest_key: z.string().max(120).nullable().optional(),
  attempt_id: z.string().uuid().nullable().optional(),
  assignment_code: z.string().max(20).nullable().optional(),
  session_id: z.string().max(64).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

const BatchSchema = z.object({
  events: z.array(EventSchema).min(1).max(20),
});

function safeMeta(m: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!m) return {};
  try {
    const s = JSON.stringify(m);
    if (s.length <= 4000) return m;
    return { _truncated: true, preview: s.slice(0, 1000) };
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json().catch(() => null);
    const parsed = BatchSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

    const ua = request.headers.get('user-agent')?.slice(0, 300) ?? null;
    let userId: string | null = null;
    let username: string | null = null;
    try {
      const supabase = await supabaseServer();
      const { data } = await supabase.auth.getClaims();
      const uid = data?.claims?.sub;
      if (uid) {
        userId = uid;
        const { data: p } = await supabaseAdmin().from('profiles').select('username').eq('id', uid).maybeSingle();
        username = p?.username ?? null;
      }
    } catch { /* khách hoặc chưa đăng nhập */ }

    const rows = parsed.data.events.map((e) => ({
      level: e.level,
      category: e.category,
      event: e.event,
      message: e.message ?? null,
      path: e.path ?? null,
      user_id: userId,
      username,
      guest_key: userId ? null : (e.guest_key ?? request.cookies.get('eh_guest')?.value?.slice(0, 120) ?? null),
      attempt_id: e.attempt_id ?? null,
      assignment_code: e.assignment_code ? e.assignment_code.toLowerCase() : null,
      session_id: e.session_id ?? null,
      meta: safeMeta(e.meta),
      user_agent: ua,
    }));

    await supabaseAdmin().from('trace_events').insert(rows);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
