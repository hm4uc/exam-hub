# Kiến trúc và mô hình dữ liệu MVP là gì?

Type: grilling
Status: resolved
Blocked by: 01, 02, 03, 04, 05, 11, 12

## Question

Chốt: schema Postgres (Lớp, Học sinh, Đề thi, Câu hỏi, Bài giao, Bài làm), Row Level Security, phân chia việc giữa Next.js (Vercel) và Supabase, nơi chạy phân giải .docx, chấm điểm ở server, tự lưu, giờ server, cách không để lộ đáp án. Đầu ra là phần kiến trúc của spec.

## Answer

Chốt với giáo viên ngày 2026-11-18 (theo đề xuất):

1. **Stack:** Next.js 16 (App Router, TypeScript) trên Vercel; Supabase (Postgres, Auth, Storage); **Tailwind CSS v3** (v4 cần Safari 16.4); KaTeX render sẵn ở server; xuất Excel ngay trên trình duyệt.
2. **Đăng nhập không email:** Supabase Auth email/mật khẩu với email nội bộ sinh từ tên đăng nhập (`<username>@hs.local`), không gửi thư. Đặt lại mật khẩu chạy ở server (service role key không xuống client); cờ `must_change_password`. Phiên vĩnh viễn: refresh token không đặt hạn; cookie HttpOnly đặt từ server và gia hạn mỗi lần vào trang (trần ~400 ngày của trình duyệt). Kiểm lại tài liệu Supabase hiện hành khi viết spec.
3. **Không lộ đáp án:** học sinh không đọc thẳng bảng câu hỏi. Mọi thao tác bắt đầu/lưu/nộp đi qua hàm Postgres (RPC, SECURITY DEFINER): trả đề đã bỏ đáp án + lời giải theo thứ tự đảo riêng; từ chối ghi khi quá hạn/đã nộp (giờ server); chấm điểm trong DB khi nộp; trả kết quả theo chế độ xem kết quả. Phía giáo viên dùng RLS. Luồng này không đi qua Vercel Function.
4. **Mô hình dữ liệu:** `profiles`, `classes`, `exams`, `questions`, `assignments`, `attempts` (chi tiết cột, khoá, chỉ mục, RLS trong spec). Sửa đáp án → DB chấm lại các Bài làm liên quan.
5. **Phân giải .docx:** trên trình duyệt giáo viên (Web Worker) → ảnh lên Supabase Storage bằng signed URL → server kiểm tra JSON, render KaTeX, lưu **bản nháp** → giáo viên soát, sửa, Xuất bản.
6. **Sao lưu + giữ Supabase hoạt động:** GitHub Actions chạy mỗi ngày, dump DB + Storage vào repo GitHub riêng tư của giáo viên.
