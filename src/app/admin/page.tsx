import type { Metadata } from 'next';
import { PageTitle } from '@/components/ui';
import { TraceViewer } from '@/features/trace/trace-viewer';
import type { TraceRow } from '@/lib/trace-types';
import { supabaseServer } from '@/server/supabase/server';

export const metadata: Metadata = { title: 'Nhật ký & theo dõi sự cố' };

const RANGE_MS: Record<string, number> = {
  '1h': 3600 * 1000,
  '24h': 24 * 3600 * 1000,
  '7d': 7 * 24 * 3600 * 1000,
  '30d': 30 * 24 * 3600 * 1000,
};

export default async function AdminTracePage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; cat?: string; range?: string; q?: string; session?: string; attempt?: string }>;
}) {
  const sp = await searchParams;
  const level = ['error', 'warn', 'info'].includes(sp.level ?? '') ? sp.level! : '';
  const cat = ['exam', 'auth', 'error', 'network', 'nav', 'admin'].includes(sp.cat ?? '') ? sp.cat! : '';
  const range = sp.range && sp.range in RANGE_MS ? sp.range : '24h';
  const q = (sp.q ?? '').trim();
  const session = (sp.session ?? '').trim();
  const attempt = /^[0-9a-f-]{36}$/i.test(sp.attempt ?? '') ? sp.attempt! : '';

  const supabase = await supabaseServer();
  // Server Component: thời điểm hiện tại theo từng request
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const since24h = new Date(now - 24 * 3600 * 1000).toISOString();
  const sinceRange = new Date(now - RANGE_MS[range]).toISOString();
  const nowIso = new Date(now).toISOString();

  let listQuery = supabase
    .from('trace_events')
    .select('id, created_at, level, category, event, message, path, user_id, username, guest_key, attempt_id, assignment_code, session_id, meta, user_agent')
    .gte('created_at', sinceRange)
    .order('created_at', { ascending: false })
    .limit(150);

  if (level) listQuery = listQuery.eq('level', level);
  if (cat) listQuery = listQuery.eq('category', cat);
  if (session) listQuery = listQuery.eq('session_id', session);
  if (attempt) listQuery = listQuery.eq('attempt_id', attempt);
  if (q) {
    const clean = q.replace(/[%,()]/g, '');
    listQuery = listQuery.or(
      `username.ilike.%${clean}%,assignment_code.ilike.%${clean}%,message.ilike.%${clean}%,event.ilike.%${clean}%,path.ilike.%${clean}%,guest_key.ilike.%${clean}%`,
    );
  }

  const [{ data: rows }, { count: errors24h }, { count: warns24h }, { count: total24h }, { count: activeAttempts }] = await Promise.all([
    listQuery,
    supabase.from('trace_events').select('id', { count: 'exact', head: true }).eq('level', 'error').gte('created_at', since24h),
    supabase.from('trace_events').select('id', { count: 'exact', head: true }).eq('level', 'warn').gte('created_at', since24h),
    supabase.from('trace_events').select('id', { count: 'exact', head: true }).gte('created_at', since24h),
    supabase.from('attempts').select('id', { count: 'exact', head: true }).is('submitted_at', null).gt('deadline_at', nowIso),
  ]);

  return (
    <>
      <PageTitle title="Nhật ký &amp; theo dõi sự cố" />
      <TraceViewer
        rows={(rows ?? []) as TraceRow[]}
        filters={{ level, cat, range, q, session, attempt }}
        stats={{
          errors24h: errors24h ?? 0,
          warns24h: warns24h ?? 0,
          total24h: total24h ?? 0,
          activeAttempts: activeAttempts ?? 0,
        }}
      />
    </>
  );
}
