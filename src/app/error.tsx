'use client';
import { Button } from '@/components/ui';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-xl font-bold">Có lỗi xảy ra</h1>
      <p className="mt-1 text-muted">Có thể do mạng chập chờn. Bài làm vẫn được lưu trên máy chủ.</p>
      <Button className="mt-5" onClick={() => reset()}>Thử lại</Button>
    </main>
  );
}
