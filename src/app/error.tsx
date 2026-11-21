'use client';
import { useEffect } from 'react';
import { Button } from '@/components/ui';
import { traceClient } from '@/lib/trace-client';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    traceClient({
      level: 'error',
      category: 'error',
      event: 'react_error_boundary',
      message: error?.message || 'React error boundary triggered',
      meta: { digest: error?.digest, stack: error?.stack?.slice(0, 800) },
      urgent: true,
    });
  }, [error]);

  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-xl font-bold">Có lỗi xảy ra</h1>
      <p className="mt-1 text-muted">Có thể do mạng chập chờn. Bài làm vẫn được lưu trên máy chủ.</p>
      <Button className="mt-5" onClick={() => reset()}>Thử lại</Button>
    </main>
  );
}
