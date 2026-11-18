# Product

**Exam Hub** — công cụ kiểm tra trực tuyến của một giáo viên Toán THPT cho học sinh của mình (dưới 100 em).

## Người dùng và bối cảnh

- **Giáo viên** (một người): soạn đề bằng Word như thường ngày, làm việc trên máy tính. Cần nhanh: tải đề → soát → giao → gửi link Zalo.
- **Học sinh lớp 10–12**: làm bài chủ yếu trên điện thoại, mở link từ Zalo (trình duyệt trong app), mạng có thể chập chờn; cũng dùng máy tính ở nhà/trường.

## Nhiệm vụ chính

1. Biến file Word thành đề trực tuyến với công thức hiển thị chuẩn và đáp án đúng.
2. Học sinh làm bài có giờ, không mất bài khi mất mạng/tắt app.
3. Giáo viên thấy ngay ai đã làm, điểm bao nhiêu, xuất Excel.

## Ràng buộc

- Chi phí 0đ (Supabase Free + Vercel Hobby). Tương thích iOS 15.4+, Chrome 109+, trình duyệt Zalo/Messenger.
- Không lộ đáp án ra trình duyệt khi đang làm; chấm ở server.
- Tiếng Việt, cấu trúc đề theo chuẩn Bộ (trắc nghiệm, Đúng/Sai, trả lời ngắn).
