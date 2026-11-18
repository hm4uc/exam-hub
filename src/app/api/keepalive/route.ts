import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Vercel Cron gọi mỗi ngày: một truy vấn nhỏ để project Supabase Free không bị tạm dừng sau 7 ngày không hoạt động.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const { count, error } = await supabaseAdmin().from('profiles').select('id', { count: 'exact', head: true });
  return NextResponse.json({ ok: !error, profiles: count ?? null, at: new Date().toISOString() });
}
