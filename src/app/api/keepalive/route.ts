import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/server/supabase/admin';

// Vercel Cron gọi mỗi ngày: một truy vấn nhỏ để project Supabase Free không bị tạm dừng sau 7 ngày không hoạt động.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  // Bắt buộc có CRON_SECRET (deploy-vercel.mjs luôn đặt): thiếu biến thì từ chối thay vì mở công khai.
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const { count, error } = await supabaseAdmin().from('profiles').select('id', { count: 'exact', head: true });
  return NextResponse.json({ ok: !error, profiles: count ?? null, at: new Date().toISOString() });
}
