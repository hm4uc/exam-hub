import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Trình duyệt chưa hỗ trợ' };

// Trang tĩnh, không cần JavaScript: hiển thị được cả trên trình duyệt rất cũ.
export default function Unsupported() {
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-xl font-bold">Trình duyệt này đã quá cũ</h1>
      <p className="mt-2 text-muted">Trang làm bài cần trình duyệt mới hơn để hiển thị công thức và lưu bài an toàn. Bạn có thể:</p>
      <ul className="mt-3 list-disc space-y-1.5 pl-5">
        <li>Cập nhật iPhone/iPad lên iOS 15.4 trở lên, hoặc cập nhật Chrome.</li>
        <li>Mở link bằng Chrome, Edge, Firefox hoặc Safari phiên bản mới.</li>
        <li>Dùng máy tính hoặc điện thoại khác.</li>
      </ul>
    </main>
  );
}
