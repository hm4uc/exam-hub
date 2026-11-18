# Mẫu quy ước của file Word đề thi là gì?

Type: grilling
Status: resolved
Blocked by: 01, 09

## Question

Giáo viên soạn theo quy ước nào để hệ thống phân giải chắc chắn: đánh dấu Phần I/II/III, bắt đầu câu ("Câu 1."), phương án A–D, ý a)–d), cách đánh dấu đáp án đúng cho từng dạng (gạch chân / tô màu / bảng đáp án cuối file), có lời giải hay không, xử lý khi file sai mẫu (báo lỗi ở câu nào). Phụ thuộc kết luận MathType ở phiếu 01.

## Answer

Chốt với giáo viên ngày 2026-11-18 (theo đề xuất):

1. **Đáp án đúng nhận từ 3 nguồn**: `BẢNG ĐÁP ÁN`; `Câu n: Đáp án X.` trong lời giải; gạch chân hoặc tô đỏ phương án/ý đúng. Các nguồn mâu thuẫn → báo lỗi ở câu đó để giáo viên chọn. Câu không có đáp án → đánh dấu đỏ ở màn xem trước, chưa cho xuất bản.
2. **Nhận dạng Dạng câu theo cấu trúc**: có `A.`–`D.` → trắc nghiệm; có `a)`–`d)` → Đúng/Sai; không có cả hai → trả lời ngắn. Tiêu đề `PHẦN I/II/III` có hay không đều được. Bảng đáp án: `1.A`, `11.ĐSĐS`, `15.0,7`, nhiều đáp án chấp nhận `15.0,33|0,3`.
3. Câu bắt đầu bằng `Câu n:` / `Câu n.`; dòng `HẾT` ngăn phần đề với phần đáp án/lời giải.
4. **Lời giải chi tiết** (`HƯỚNG DẪN GIẢI CHI TIẾT`, `Câu n: …`) được lưu theo từng câu và chỉ hiện khi Bài giao để chế độ "xem điểm + đáp án".
5. **Ưu tiên định dạng chữ thường** như hai đề mẫu (công thức bằng ký tự Unicode). MathType và hình vẫn hiển thị dưới dạng ảnh; không làm phần sửa công thức trong MVP. Hình vẽ bằng Shapes → báo lỗi kèm số câu.
6. Soạn sẵn một **file Word mẫu** đúng quy ước cho giáo viên (một phiếu triển khai trong spec).
