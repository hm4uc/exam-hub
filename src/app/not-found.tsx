import { ButtonLink } from '@/components/ui';

export default function NotFound() {
  return (
    <main id="main-content" className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="grade-mark num text-6xl leading-none">404</p>
      <h1 className="mt-4 text-xl font-bold tracking-tight">Không tìm thấy trang</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">Đường link có thể bị gõ sai hoặc bài kiểm tra đã bị xoá.</p>
      <ButtonLink href="/" className="mt-6">Về trang chủ</ButtonLink>
    </main>
  );
}
