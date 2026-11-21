'use client';
import { useEffect } from 'react';
import { traceClient } from '@/lib/trace-client';

// Thay cho layout gốc khi chính layout lỗi: tự có <html>/<body>, không dùng style toàn cục.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    traceClient({
      level: 'error',
      category: 'error',
      event: 'react_error_boundary',
      message: error?.message || 'Global error boundary triggered',
      meta: { global: true, digest: error?.digest, stack: error?.stack?.slice(0, 800) },
      urgent: true,
    });
  }, [error]);

  return (
    <html lang="vi">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 480, margin: '0 auto', color: '#161e34' }}>
        <title>Có lỗi xảy ra</title>
        <h1 style={{ fontSize: 20 }}>Có lỗi xảy ra</h1>
        <p>Trang chưa tải được. Bài làm của bạn vẫn được lưu trên máy chủ.</p>
        <button onClick={() => reset()} style={{ padding: '10px 16px', borderRadius: 8, border: 0, background: '#2540c4', color: '#fff', fontWeight: 600 }}>Thử lại</button>
      </body>
    </html>
  );
}
