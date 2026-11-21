import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Exam Hub — Kiểm tra trực tuyến',
    short_name: 'Exam Hub',
    description: 'Làm bài kiểm tra trực tuyến chuẩn công thức Toán, lưu bài liên tục, chấm điểm tự động.',
    start_url: '/',
    display: 'standalone',
    lang: 'vi',
    background_color: '#f3f6fb',
    theme_color: '#0e1e4a',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
