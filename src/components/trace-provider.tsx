'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { flushTracesNow, traceClient } from '@/lib/trace-client';

/** Ghi nhận lỗi JS toàn cục, sự kiện mạng, nút Back và chuyển trang (nhẹ, không làm chậm trang). */
export function TraceProvider() {
  const pathname = usePathname();
  const prevPath = useRef<string | null>(null);

  // Theo dõi chuyển trang (bỏ qua các trang /admin để tránh tạo vòng lặp log)
  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) {
      prevPath.current = pathname;
      return;
    }
    if (prevPath.current !== pathname) {
      traceClient({
        category: 'nav',
        event: 'page_view',
        path: pathname,
        meta: prevPath.current ? { from: prevPath.current } : undefined,
      });
      prevPath.current = pathname;
    }
  }, [pathname]);

  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      traceClient({
        level: 'error',
        category: 'error',
        event: 'window_error',
        message: e.message || 'Unhandled error',
        meta: {
          filename: e.filename?.slice(0, 200),
          lineno: e.lineno,
          colno: e.colno,
          stack: e.error?.stack ? String(e.error.stack).slice(0, 800) : undefined,
        },
        urgent: true,
      });
    };

    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      const msg = reason instanceof Error ? reason.message : String(reason ?? 'Unhandled rejection');
      traceClient({
        level: 'error',
        category: 'error',
        event: 'unhandled_rejection',
        message: msg.slice(0, 400),
        meta: reason instanceof Error && reason.stack ? { stack: reason.stack.slice(0, 800) } : undefined,
        urgent: true,
      });
    };

    const onOffline = () => {
      traceClient({ level: 'warn', category: 'network', event: 'network_offline', message: 'Mất kết nối mạng' });
    };

    const onOnline = () => {
      traceClient({ level: 'info', category: 'network', event: 'network_online', message: 'Có kết nối mạng trở lại' });
      flushTracesNow(false);
    };

    const onPopState = () => {
      if (window.location.pathname.startsWith('/admin')) return;
      traceClient({
        level: 'info',
        category: 'nav',
        event: 'browser_back',
        message: `Điều hướng lịch sử tới ${window.location.pathname}`,
        meta: { from: prevPath.current },
      });
    };

    const onPageHide = () => flushTracesNow(true);

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    window.addEventListener('popstate', onPopState);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  return null;
}
