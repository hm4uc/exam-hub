# MathType và hình học trong .docx hiển thị lên web thế nào?

Type: research
Status: resolved
Blocked by: -

## Question

Đề Toán soạn bằng Word chứa công thức MathType (OLE object: dữ liệu MTEF + ảnh xem trước WMF/EMF), có thể cả Equation gốc của Word (OMML), và hình vẽ (PNG/JPG/EMF/WMF, có khi là shape/drawing canvas). Cần biết:

1. Cách đáng tin cậy nhất để biến từng loại thành thứ trình duyệt hiển thị được (MathML/LaTeX qua KaTeX/MathJax, SVG/PNG): thư viện nào (ưu tiên JS/TS), độ trưởng thành, giấy phép.
2. Việc chuyển đổi chạy được ở đâu trong môi trường 0đ: trình duyệt của giáo viên, Vercel Function (Node, giới hạn thời gian/dung lượng), hay Supabase Edge Function (Deno).
3. Phương án dự phòng khi không chuyển được (giữ ảnh xem trước của MathType? yêu cầu giáo viên dùng MathType "Convert Equations" sang Office Math trước khi tải lên?).

Kết luận cần ra: một khuyến nghị kèm đánh đổi.

## Context

- Kết quả nghiên cứu: `.scratch/exam-hub/research/01-mathtype-hinh-hoc-docx.md`

## Answer

- **Phân giải ngay trên trình duyệt của giáo viên** (Web Worker): né giới hạn 4,5 MB của Vercel và 2 s CPU của Supabase Edge, và máy giáo viên có sẵn font MathType để vẽ ảnh đúng. Server chỉ nhận JSON + ảnh PNG (lên Supabase Storage) và **kiểm tra lại JSON** vì logic phân giải nằm ở client.
- **Equation gốc của Word (OMML)** → MathML → **LaTeX**, hiển thị bằng KaTeX. LaTeX là định dạng lưu trữ, nên sửa được trên web. Văn bản `$…$` cũng đọc thẳng thành LaTeX.
- **MathType (MVP): dùng ảnh xem trước WMF/EMF có sẵn trong file, đổi sang PNG độ phân giải 2–3x.** Không thư viện JS nào đổi được định dạng nhị phân của MathType sang LaTeX. Đánh đổi: hiển thị giống hệt Word nhưng không sửa được công thức đó trên web. Chuyển MathType sang LaTeX là việc để sau.
- **Hình:** PNG/JPG giữ nguyên, EMF/WMF đổi sang PNG. Hình vẽ bằng shape/drawing canvas thì **báo lỗi kèm số câu**, yêu cầu dán lại thành ảnh (quy ước này đưa vào phiếu Mẫu đề Word).
- **Dự phòng tuỳ chọn:** MathType "Convert Equations" không đổi được sang Office Math, nhưng đổi được sang văn bản LaTeX `$…$` để hệ thống đọc thẳng.
- Phải thử trên 2–3 đề thật trước khi chốt mẫu đề (xem phiếu Gửi đề mẫu và phiếu Thử phân giải đề thật).

Chi tiết và nguồn: [research/01-mathtype-hinh-hoc-docx.md](../research/01-mathtype-hinh-hoc-docx.md)
