import type { NextConfig } from 'next';

// Ứng dụng gần như toàn trang động (làm bài / quản lý) nên không bật cacheComponents.
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
        ],
      },
    ];
  },
};

export default nextConfig;
