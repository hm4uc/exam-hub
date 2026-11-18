import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { COOKIE_OPTIONS, SUPABASE_ANON_KEY, SUPABASE_URL } from './env';

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieOptions: COOKIE_OPTIONS,
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Gọi từ Server Component: không ghi được cookie. Proxy đã làm mới phiên nên bỏ qua.
        }
      },
    },
  });
}
