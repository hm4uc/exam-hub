import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { clientKey, rateLimit } from '@/server/rate-limit';
import { supabaseAdmin } from '@/server/supabase/admin';
import { supabaseServer } from '@/server/supabase/server';

const EXTENSION_RE = /(?:chrome|moz|safari|safari-web|edge|ms-browser)-extension:\/\/|webkit-masked-url:\/\/|\/executors\/\d+\.js/i;

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

function isExtensionNoise(e: z.infer<typeof EventSchema>): boolean {
  if (e.category !== 'error') return false;
  const stack = typeof e.meta?.stack === 'string' ? e.meta.stack : '';
  const file = typeof e.meta?.filename === 'string' ? e.meta.filename : '';
  return EXTENSION_RE.test(stack) || EXTENSION_RE.test(file);
}

// Endpoint công khai (khách làm bài cũng gửi): giới hạn kích thước và tần suất để không bị spam đầy CSDL.
const MAX_BODY_BYTES = 64 * 1024;
const LIMIT = { windowSeconds: 60, limit: 60 };

export async function POST(request: NextRequest) {
  try {
    const declared = Number(request.headers.get('content-length') ?? 0);
    if (declared > MAX_BODY_BYTES) return NextResponse.json({ ok: false }, { status: 413 });
    if (!(await rateLimit(`trace:${clientKey(request)}`, LIMIT)))
      return NextResponse.json({ ok: false }, { status: 429, headers: { 'Retry-After': '60' } });

    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return NextResponse.json({ ok: false }, { status: 413 });
    let raw: unknown = null;
    try { raw = JSON.parse(text); } catch { /* body không phải JSON */ }
    const parsed = BatchSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

    // category 'admin' chỉ do server ghi (recordTrace); không nhận từ trình duyệt.
    const validEvents = parsed.data.events.filter((e) => e.category !== 'admin' && !isExtensionNoise(e));
    if (!validEvents.length) return NextResponse.json({ ok: true });

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

    const rows = validEvents.map((e) => ({
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
