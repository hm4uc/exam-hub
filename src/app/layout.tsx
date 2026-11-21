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

export const metadata: Metadata = {
  title: { default: 'Exam Hub', template: '%s · Exam Hub' },
  description: 'Làm bài kiểm tra trực tuyến',
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
      <body className="min-h-dvh font-sans"><DropGuard /><TraceProvider />{children}</body>
    </html>
  );
}
