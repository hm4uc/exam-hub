import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import { DropGuard } from '@/components/drop-guard';
import { THEME_BOOT, THEME_COLOR } from '@/components/theme';
import { TraceProvider } from '@/components/trace-provider';
import './globals.css';

const sans = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: 'Exam Hub',
  title: { default: 'Exam Hub — Kiểm tra trực tuyến', template: '%s · Exam Hub' },
  description: 'Làm bài kiểm tra trực tuyến nhanh gọn: mở link làm ngay, chuẩn công thức Toán, tự động lưu khi mất mạng, chấm điểm tức thì.',
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    siteName: 'Exam Hub',
    title: 'Exam Hub — Kiểm tra trực tuyến',
    description: 'Mở link làm bài ngay · Tự động lưu khi mất mạng · Chấm điểm và xem đáp án tức thì.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Exam Hub — Kiểm tra trực tuyến',
    description: 'Mở link làm bài ngay · Tự động lưu khi mất mạng · Chấm điểm tức thì.',
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLOR.light },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLOR.dark },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={sans.variable} suppressHydrationWarning style={{ ['--font-num' as string]: 'var(--font-sans)' }}>
      <head>
        {/* Áp chế độ Sáng/Tối đã chọn trước khi vẽ trang */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        {/* Trình duyệt quá cũ (trước Safari 15.4 / Chrome 92) → trang hướng dẫn */}
        <script dangerouslySetInnerHTML={{ __html: "if(!Array.prototype.at&&location.pathname!=='/thiet-bi-chua-ho-tro')location.replace('/thiet-bi-chua-ho-tro')" }} />
      </head>
      <body className="min-h-dvh font-sans">
        <a href="#main-content" className="skip-link">Chuyển tới nội dung chính</a>
        <DropGuard />
        <TraceProvider />
        {children}
      </body>
    </html>
  );
}
