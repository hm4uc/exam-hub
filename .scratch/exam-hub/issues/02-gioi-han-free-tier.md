# Giới hạn gói miễn phí Supabase + Vercel ảnh hưởng gì đến hệ thống?

Type: research
Status: resolved
Blocked by: -

## Question

Liệt kê từ tài liệu chính thức (bản hiện hành) các giới hạn liên quan:

- Supabase free: tự tạm dừng project khi không hoạt động, dung lượng DB/Storage, egress, số kết nối, Auth, Edge Functions, Realtime, backup.
- Vercel Hobby: điều khoản dùng phi thương mại, giới hạn body upload của Function, thời gian chạy, bandwidth, cron.

Với mỗi giới hạn: có chạm tới ở quy mô dưới 100 học sinh / tối đa 10 đồng thời không, và cách giảm thiểu (ví dụ upload thẳng lên Supabase Storage bằng signed URL, cron giữ project không bị pause).

## Context

Kết quả nghiên cứu (có trích nguồn, bảng "giới hạn | có chạm không | giảm thiểu" và hệ quả thiết kế): [research/02-gioi-han-free-tier.md](../research/02-gioi-han-free-tier.md)

## Answer

Ở quy mô hiện tại, gói miễn phí đủ dùng nếu thiết kế né được ba điểm nghẽn:

- **Supabase tự tạm dừng sau 1 tuần không có hoạt động DB** (dữ liệu vẫn giữ, bấm Resume là chạy lại) và **không có backup tự động** → cần GitHub Action theo lịch vừa dump DB + Storage, vừa giữ project hoạt động (giữ project hoạt động bằng ping là vùng xám, không bị cấm).
- **Vercel Hobby: body 4,5 MB, vượt hạn mức tháng là tính năng bị dừng tới 30 ngày** → file .docx không đi qua Function (upload signed URL thẳng lên Supabase Storage hoặc phân giải ngay trên trình duyệt); tự lưu/nộp bài nên gọi Supabase trực tiếp với RLS.
- **Cron không thể canh hạn nộp** (Hobby 1 lần/ngày) → hạn nộp kiểm ở server khi ghi (từ chối ghi sau hạn), không dựa cron.
- Edge Function chỉ 2 s CPU → không phân giải .docx ở đó. Email mặc định 2 thư/giờ → không dựa email cho học sinh. `next/image` 5.000 lần/tháng → nén ảnh lúc nhập, hiển thị `<img>` thường.
- Điều khoản phi thương mại: công cụ miễn phí giáo viên dùng cho học sinh của mình là ổn; sẽ rủi ro nếu thu phí / trung tâm dùng.
