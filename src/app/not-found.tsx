import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="grade-mark text-5xl">404</p>
      <h1 className="mt-3 text-xl font-bold">Không tìm thấy trang</h1>
      <p className="mt-1 text-muted">Đường link có thể bị gõ sai hoặc bài đã bị xoá.</p>
      <Link href="/" className="mt-5 inline-block font-semibold text-brand underline">Về trang chủ</Link>
    </main>
  );
}
