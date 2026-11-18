# Những trình duyệt nào cần hỗ trợ và chúng có bẫy gì cho trang làm bài?

Type: research
Status: resolved
Blocked by: -

## Question

Đối tượng: Chrome/Edge/Firefox trên máy tính, Safari macOS/iOS (kể cả bản cũ còn phổ biến ở VN), Chrome Android, trình duyệt trong Zalo và Messenger (WebView). Cần biết:

1. Cách hiển thị công thức an toàn trên tất cả: KaTeX (HTML) hay MathML Core gốc hay MathJax; mức hỗ trợ và hiệu năng trên máy yếu.
2. Độ tin cậy của localStorage/IndexedDB và các sự kiện visibilitychange/pagehide (dùng để tự lưu và đếm rời tab) trong WebView Zalo/iOS.
3. Mốc trình duyệt tối thiểu hợp lý để đặt target build (browserslist) cho Next.js.
4. Các lỗi đã biết của WebView Zalo (cookie, mở link, tải file).

## Context

Kết quả nghiên cứu: [`.scratch/exam-hub/research/03-tuong-thich-trinh-duyet.md`](../research/03-tuong-thich-trinh-duyet.md) (KaTeX render sẵn ở server; tự lưu dựa vào server + `visibilitychange`/`pagehide` + `fetch keepalive`; đề xuất browserslist Safari/iOS 15.4; các bẫy WebView Zalo/Messenger; ma trận kiểm thử).

## Answer

- **Công thức: KaTeX render sẵn ở server** (lúc lưu/xuất bản câu hỏi, output `htmlAndMathml`). Trang làm bài chỉ tải CSS + font của KaTeX, không tải JS. Không dùng MathML gốc làm đường chính, không dùng MathJax (nặng). Ghim phiên bản KaTeX; khi nâng cấp thì render lại toàn bộ câu hỏi.
- **Bản gốc của Bài làm nằm ở server**; localStorage chỉ là bản nháp đệm (Safari xoá dữ liệu trang sau 7 ngày không vào; WebView Android có thể tắt localStorage). Lưu khi có thay đổi + khi `visibilitychange`(hidden)/`pagehide` bằng `fetch keepalive`, dự phòng `sendBeacon`. Không dựa `beforeunload`.
- **Đếm rời tab chỉ mang tính tham khảo** (WebView Zalo/Messenger Android không bắn sự kiện chắc chắn): kết hợp `visibilitychange` + `blur` + heartbeat server; giáo viên thấy là "ước lượng".
- **Đồng hồ** tính lại từ hạn nộp của server ở mỗi nhịp (trình duyệt làm chậm timer khi ẩn trang).
- **Mốc trình duyệt** (giáo viên yêu cầu "tương thích hết"): hạ dưới mặc định của Next.js xuống **Safari/iOS 15.4, Chrome 109, Firefox 115, Samsung Internet 21** (khoảng 1,8% máy di động ở VN dùng iOS 15). Hệ quả: không dùng Tailwind v4 (cần Safari 16.4); phải thử trên máy iOS 15 thật. Máy cũ hơn mốc thấy trang "thiết bị chưa hỗ trợ".
- **Zalo/Messenger:** cookie và bộ nhớ tách biệt với Chrome/Safari, nên mở link ở Zalo rồi chuyển sang Chrome là "trình duyệt mới". Học sinh không bao giờ phải tải file. Nhận diện Zalo/Messenger qua user agent để gợi ý "mở bằng trình duyệt", nhưng vẫn cho làm bài ngay trong app.
- Trước khi ra mắt chạy ma trận kiểm thử trên máy thật (có trong file nghiên cứu).
