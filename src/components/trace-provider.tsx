'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { flushTracesNow, traceClient } from '@/lib/trace-client';

const EXTENSION_RE = /(?:chrome|moz|safari|safari-web|edge|ms-browser)-extension:\/\/|webkit-masked-url:\/\/|extension:\/\/|\/executors\/\d+\.js/i;

function isThirdPartyExtensionError(filename?: string, stack?: string, message?: string): boolean {
  if (filename && EXTENSION_RE.test(filename)) return true;
  if (stack && EXTENSION_RE.test(stack)) return true;
  // Cross-origin opaque error without stack/filename (không thuộc nguồn ứng dụng)
  if (message === 'Script error.' && !filename && !stack) return true;
  return false;
}

/** Ghi nhận lỗi JS toàn cục của ứng dụng, sự kiện mạng, nút Back và chuyển trang.
 *  Tự động bỏ qua lỗi từ tiện ích mở rộng (browser extension) và chống lặp lỗi trùng trong 15 giây. */
export function TraceProvider() {
  const pathname = usePathname();
  const prevPath = useRef<string | null>(null);
  const recentErrors = useRef<Map<string, number>>(new Map());

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
    const shouldReport = (key: string) => {
      const now = Date.now();
      const last = recentErrors.current.get(key) ?? 0;
      if (now - last < 15000) return false;
      recentErrors.current.set(key, now);
      if (recentErrors.current.size > 40) recentErrors.current.clear();
      return true;
    };

    const onError = (e: ErrorEvent) => {
      const stack = e.error?.stack ? String(e.error.stack) : undefined;
      if (isThirdPartyExtensionError(e.filename, stack, e.message)) return;
      const msg = e.message || 'Unhandled error';
      if (!shouldReport(`err:${msg}`)) return;
      traceClient({
        level: 'error',
        category: 'error',
        event: 'window_error',
        message: msg,
        meta: {
          filename: e.filename?.slice(0, 200),
          lineno: e.lineno,
          colno: e.colno,
          stack: stack?.slice(0, 800),
        },
        urgent: true,
      });
    };

    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      const stack = reason instanceof Error && reason.stack ? String(reason.stack) : undefined;
      const msg = reason instanceof Error ? reason.message : String(reason ?? 'Unhandled rejection');
      if (isThirdPartyExtensionError(undefined, stack, msg)) return;
      if (!shouldReport(`rej:${msg}`)) return;
      traceClient({
        level: 'error',
        category: 'error',
        event: 'unhandled_rejection',
        message: msg.slice(0, 400),
        meta: stack ? { stack: stack.slice(0, 800) } : undefined,
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
