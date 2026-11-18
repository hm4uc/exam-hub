# Phân giải đề thật trong trình duyệt có ra kết quả dùng được không?

Type: prototype
Status: resolved
Blocked by: 06

## Question

Spike thô chạy trên các đề trong `samples/` theo mẫu đề vừa chốt (cả 3 nguồn đáp án): tỉ lệ MathType / OMML / shape trong đề; `wmf-emf-renderer` vẽ ảnh MathType có rõ và đúng font không; ảnh công thức có thẳng hàng với chữ khi hiển thị không; KaTeX có hiển thị đủ LaTeX đổi từ OMML không. Giáo viên xem kết quả và đánh giá chấp nhận được hay không.

## Context

- Prototype (chờ giáo viên đánh giá): https://claude.ai/artifact/Xe44S6ryVgGoJt3Au9pW8f, mã nguồn ở `prototypes/parser-spike/`.
- Kết quả chạy spike: 2 đề thật (10 + 20 câu) phân giải đúng 30/30 câu, đáp án khớp giữa bảng đáp án và lời giải. Đề tổng hợp (`samples/De_TongHop_3Dang_ThuParser.docx`, tự tạo) có đủ 3 Dạng câu: nhận đúng phương án nằm chung một dòng (tab), gạch chân/tô đỏ, Đ/S, trả lời ngắn nhiều đáp án; bắt được 3 lỗi cố ý (mâu thuẫn bảng/lời giải, mâu thuẫn gạch chân/bảng ở câu Đ/S, thiếu đáp án). Đã sửa 1 lỗi: dấu chấm cuối câu bị dính vào đáp án trả lời ngắn trong lời giải.
- Chưa kiểm được MathType/OMML/hình vì chưa có đề mẫu chứa chúng.

## Answer

Giáo viên duyệt (2026-11-18) và yêu cầu **xử lý công thức toán chuẩn từ docx**. Đã bổ sung vào spike và chạy thử (292 công thức, 0 lỗi render):
- **Equation của Word (OMML) → LaTeX** bằng bộ chuyển tự viết (phân số, mũ/chỉ số, căn, ngoặc co giãn, hệ phương trình, tổng/tích phân, lim, hàm, vectơ, gạch trên, ma trận). Không dùng `omml2mathml` (đã archived).
- **Công thức gõ bằng chữ** (như 2 đề của giáo viên): nhận nguyên **cụm biểu thức** (số, chữ đơn, tên hàm, π, ký hiệu, ngoặc) rồi chuyển sang LaTeX: `π/6` → phân số, `√3`/`√(…)` → căn, `sin²x`, `<=`/`>=`/`<=>`/`=>` → ≤ ≥ ⇔ ⇒, `∈ Z` → ℤ, dấu phẩy thập phân. Không bắt nhầm đơn vị (`cm/s`) hay từ tiếng Việt ("sinh").
- `$…$` giáo viên gõ được giữ nguyên làm LaTeX. MathType vẫn hiển thị dạng ảnh (chưa có đề mẫu).
- Biểu diễn lưu trữ: văn bản xen LaTeX trong `\( … \)`; render KaTeX ở server với `\displaystyle`.
- Giới hạn đã biết: `π t / 12` thành `π·(t/12)` (đúng giá trị, khác cách viết). Giáo viên sửa được ở màn xem trước.
