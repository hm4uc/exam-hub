import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_OPTIONS, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/server/supabase/env';

const PUBLIC = [
  '/dang-nhap',
  '/dang-ky',
  '/dang-ky-giao-vien',
  '/thiet-bi-chua-ho-tro',
  '/api/keepalive',
  '/api/trace',
  '/manifest.webmanifest',
  '/robots.txt',
  '/icon.svg',
  '/apple-icon',
  '/opengraph-image',
];
// Link làm bài công khai: /[code], /[code]/lam, /[code]/ket-qua (mã 6 ký tự)
const PUBLIC_ASSIGNMENT = /^\/[a-z2-9]{6}(?:\/(?:lam|ket-qua))?$/i;

// Làm mới phiên Supabase ở mỗi request (gia hạn cookie) và chuyển người chưa đăng nhập khỏi khu vực nội bộ.
// Phân quyền thật nằm ở Server Component / RLS; đây chỉ là kiểm tra lạc quan.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieOptions: COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
        for (const [k, val] of Object.entries(headers ?? {})) response.headers.set(k, val);
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => path === p || path.startsWith(p + '/')) || PUBLIC_ASSIGNMENT.test(path);
  if (!data?.claims && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/dang-nhap';
    url.search = path === '/' ? '' : `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|docx|webmanifest)$).*)'],
};
