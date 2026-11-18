'use client';
import { createBrowserClient } from '@supabase/ssr';
import { COOKIE_OPTIONS, SUPABASE_ANON_KEY, SUPABASE_URL } from './env';

let client: ReturnType<typeof createBrowserClient> | null = null;

export function supabaseBrowser() {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, { cookieOptions: COOKIE_OPTIONS });
  return client;
}
