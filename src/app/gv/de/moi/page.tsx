import type { Metadata } from 'next';
import { PageTitle } from '@/components/ui';
import { UploadClient } from '@/features/exams/upload';

export const metadata: Metadata = { title: 'Tải đề lên' };

export default function NewExamPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Tải đề Word lên" back={{ href: '/gv/de', label: 'Đề thi' }} />
      <details className="mb-5 rounded-xl border border-line bg-surface p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Quy ước soạn đề (bấm để xem) · <a href="/mau-de-thi.docx" download className="text-brand underline">Tải file Word mẫu</a></summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted">
          <li>Mỗi câu bắt đầu bằng <b className="text-ink">Câu 1:</b> hoặc <b className="text-ink">Câu 1.</b> Có thể chia <b className="text-ink">PHẦN I, II, III</b>.</li>
          <li><b className="text-ink">Trắc nghiệm</b>: phương án <b className="text-ink">A. B. C. D.</b> (mỗi dòng một phương án, hoặc chung một dòng cách bằng Tab).</li>
          <li><b className="text-ink">Đúng/Sai</b>: 4 ý <b className="text-ink">a) b) c) d)</b>. <b className="text-ink">Trả lời ngắn</b>: câu không có phương án.</li>
          <li>Dòng <b className="text-ink">HẾT</b> ngăn phần đề với phần đáp án.</li>
          <li>Đáp án lấy từ <b className="text-ink">BẢNG ĐÁP ÁN</b> (<code>1.A 2.C 11.ĐSĐS 15.0,5</code>; nhiều đáp án: <code>16.0,33|0,3</code>), hoặc dòng <b className="text-ink">Câu n: Đáp án X.</b> trong <b className="text-ink">HƯỚNG DẪN GIẢI</b>, hoặc <u>gạch chân</u>/<span className="text-pen">tô đỏ</span> phương án đúng.</li>
          <li>Công thức: dùng Equation của Word hoặc gõ chữ như <code>π/6</code>, <code>√3</code>, <code>x²</code> đều được. MathType nên chuyển sang Equation.</li>
          <li>Hình: dán dạng ảnh (PNG/JPG). Hình vẽ bằng Shapes cần chụp lại thành ảnh.</li>
        </ul>
      </details>
      <UploadClient />
    </div>
  );
}
