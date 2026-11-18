import type { NextConfig } from 'next';

// Ứng dụng gần như toàn trang động (cần đăng nhập) nên không bật cacheComponents.
const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
  },
  poweredByHeader: false,
};

export default nextConfig;
