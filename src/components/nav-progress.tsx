'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/** Thanh tiến trình mảnh ở đỉnh trang: phản hồi tức thì 0ms khi bấm link chuyển màn, tự tắt khi màn mới hiện. */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams?.toString() ?? ''}`;

  const [phase, setPhase] = useState<'idle' | 'loading' | 'done'>('idle');
  const [scale, setScale] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAll = () => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  };

  // Kết thúc thanh tiến trình khi route đã chuyển xong
  useEffect(() => {
    clearAll();
    const t0 = setTimeout(() => {
      setPhase((prev) => {
        if (prev === 'idle') return 'idle';
        setScale(1);
        const t1 = setTimeout(() => {
          setPhase('idle');
          setScale(0);
        }, 220);
        timers.current.push(t1);
        return 'done';
      });
    }, 0);
    timers.current.push(t0);
    return clearAll;
  }, [routeKey]);

  // Bắt mọi click vào link nội bộ để phản hồi ngay lập tức
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

      let dest: URL;
      try { dest = new URL(anchor.href, window.location.href); } catch { return; }
      if (dest.origin !== window.location.origin) return;
      const current = `${window.location.pathname}${window.location.search}`;
      const target = `${dest.pathname}${dest.search}`;
      if (current === target) return;

      clearAll();
      setPhase('loading');
      setScale(0.22);
      timers.current.push(setTimeout(() => setScale(0.62), 120));
      timers.current.push(setTimeout(() => setScale(0.84), 600));
      // Tự ẩn phòng trường hợp điều hướng bị huỷ
      timers.current.push(setTimeout(() => { setPhase('idle'); setScale(0); }, 10000));
    };

    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      clearAll();
    };
  }, []);

  if (phase === 'idle') return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] overflow-hidden bg-transparent"
    >
      <div
        className="h-full w-full origin-left bg-brand shadow-[0_0_8px_rgb(var(--brand)/0.55)]"
        style={{
          transform: `scaleX(${scale})`,
          opacity: phase === 'done' ? 0 : 1,
          transition: phase === 'done'
            ? 'transform 160ms var(--ease-out), opacity 200ms var(--ease-out) 60ms'
            : 'transform 380ms var(--ease-out)',
        }}
      />
    </div>
  );
}
