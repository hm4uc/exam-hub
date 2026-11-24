# Product

**Exam Hub** — công cụ kiểm tra trực tuyến môn Toán cho giáo viên (tiểu học, THCS, THPT), mỗi giáo viên có đề, lớp và học sinh riêng. Thiết kế nhiều giáo viên ngay từ đầu để mở rộng; hiện dùng nội bộ vài giáo viên.

## Người dùng và bối cảnh

- **Giáo viên** (nhiều người, mỗi người chỉ thấy dữ liệu của mình; quản trị viên thấy tất cả): soạn đề bằng Word như thường ngày, làm việc trên máy tính. Cần nhanh: tải đề → soát → giao → gửi link Zalo.
- **Học sinh lớp 10–12**: làm bài chủ yếu trên điện thoại, mở link từ Zalo (trình duyệt trong app), mạng có thể chập chờn; cũng dùng máy tính ở nhà/trường.

## Nhiệm vụ chính

1. Biến file Word thành đề trực tuyến với công thức hiển thị chuẩn và đáp án đúng.
2. Học sinh làm bài có giờ, không mất bài khi mất mạng/tắt app.
3. Giáo viên thấy ngay ai đã làm, điểm bao nhiêu, xuất Excel.

## Ràng buộc

- Chi phí 0đ (Supabase Free + Vercel Hobby). Tương thích iOS 15.4+, Chrome 109+, trình duyệt Zalo/Messenger.
- Không lộ đáp án ra trình duyệt khi đang làm; chấm ở server.
- Tiếng Việt, cấu trúc đề theo chuẩn Bộ (trắc nghiệm, Đúng/Sai, trả lời ngắn). Không chấm tự luận; phần tự luận trong đề tải lên được bỏ qua.
- Đề tải lên chủ yếu là Word (.docx); PDF/ảnh là đề cũ. Nhập đề có AI hỗ trợ khi parser thường không đọc được, luôn để giáo viên soát trước khi lưu, AI không được tự bịa đáp án.
- Tên đăng nhập học sinh mang tiền tố mã giáo viên ("gva.an"); vào từ link bài giao thì chỉ cần gõ "an".
- Giáo viên mới đăng ký bằng mã mời hoặc do quản trị viên duyệt; AI có hạn mức miễn phí mỗi tháng, về sau bán theo gói.
