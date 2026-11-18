export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Phiên "vĩnh viễn": cookie sống tối đa trình duyệt cho phép (~400 ngày) và được gia hạn mỗi lần vào trang. */
export const COOKIE_OPTIONS = {
  maxAge: 400 * 24 * 60 * 60,
  sameSite: 'lax' as const,
  path: '/',
};

/** Email nội bộ cho tài khoản (học sinh không có email thật, không gửi thư). */
export const usernameToEmail = (username: string) => `${username.trim().toLowerCase()}@hs.local`;
