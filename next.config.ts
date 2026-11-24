import type { NextConfig } from 'next';

// Ứng dụng gần như toàn trang động (làm bài / quản lý) nên không bật cacheComponents.
// CSP ở chế độ báo cáo (Report-Only): trình duyệt ghi cảnh báo vào console nhưng không chặn gì.
// Xem console khi dùng thử các trang chính; nếu sạch cảnh báo thì đổi tên header thành Content-Security-Policy.
// 'unsafe-inline' còn cần cho script khởi tạo giao diện và style nội tuyến của Next.js/KaTeX.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy-Report-Only', value: CSP },
        ],
      },
    ];
  },
};

export default nextConfig;
