# Giới hạn gói miễn phí Supabase + Vercel ảnh hưởng gì đến hệ thống?

Ticket: [02-gioi-han-free-tier](../issues/02-gioi-han-free-tier.md)
Ngày tra cứu: 2026-11-18. Mọi con số dưới đây lấy từ trang chính thức tại ngày này; nhà cung cấp có thể đổi bất cứ lúc nào.

Giả định tải để ước lượng: 1 giáo viên, < 100 học sinh, tối đa 10 em làm bài cùng lúc, đề .docx có ảnh, autosave liên tục.

---

## 1. Supabase — gói Free

### 1.1 Tự tạm dừng (pause) khi không hoạt động

- **Quy tắc:** project Free bị pause sau 1 tuần không hoạt động ([pricing](https://supabase.com/pricing)). Cụ thể: project bị coi là không hoạt động nếu "không nhận đủ hoạt động database của người dùng trong tuần vừa qua"; thường chỉ cần vài request người dùng mỗi ngày trong tuần trước là đủ để không bị pause ([Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing)).
- **Hoạt động được tính:** vào project trên dashboard, gọi API vào project, hoặc request từ app đã kết nối ([Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing)). Trang này **không định nghĩa ngưỡng** "đủ" và **không nói** request tự động (cron/ping) có được tính hay bị cấm hay không.
- **Thông báo:** email cảnh báo khoảng 1 tuần trước khi pause, và email xác nhận khi đã pause ([Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing)).
- **Khôi phục:** dashboard → chọn project → "Resume project". Có **1 năm** để khôi phục trong Studio; project "trở về trạng thái trước đó, gồm cả dữ liệu và cấu hình" ([Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing)). (Changelog cũ năm 2024 ghi 90 ngày, nay đã được thay bằng 1 năm: [changelog 90 ngày](https://supabase.com/changelog/27497-paused-free-plan-projects-are-restorable-for-90-days).)
- **Quá 1 năm:** không khôi phục qua Studio được nữa; vẫn tải được file `.backup` và file Storage (nếu project chưa bị xoá) rồi dựng lại project mới; khi project bị xoá thì mọi dữ liệu kể cả backup mất vĩnh viễn ([Restore after pause](https://supabase.com/docs/guides/troubleshooting/restore-project-after-90-days-pause)).
- Project đã pause không tính vào giới hạn 2 project free ([Free plan](https://supabase.com/docs/guides/platform/free-plan)); project trả phí không bị pause ([Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing)).

**Có chạm không:** Có, gần như chắc chắn vào kỳ nghỉ (hè, Tết) khi không ai dùng > 1 tuần. Trong năm học có bài kiểm tra hàng tuần thì thường không.

**Keep-alive có được phép không:** Không tìm thấy điều khoản cấm trong [Supabase Terms](https://supabase.com/terms) (văn bản không nhắc tới free tier hay pause), và tài liệu pausing chính thức liệt kê "gọi API / request từ app đã kết nối" là cách hợp lệ để tránh pause ([Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing)). Nhưng cũng **không có văn bản chính thức nào xác nhận** ping tự động được tính. Có báo cáo cộng đồng (nguồn thứ cấp, độ tin thấp) rằng ping bằng GitHub Actions có lúc không ngăn được pause ([dev.to](https://dev.to/astraedus/my-production-app-was-down-for-24-hours-and-nobody-told-me-3nma)). Kết luận: keep-alive là vùng xám có thể chấp nhận, không nên coi là bảo đảm; luôn có phương án "resume thủ công + backup ngoài".

### 1.2 Dung lượng Database

- Quota: 500 MB database / project ([pricing](https://supabase.com/pricing); [Billing](https://supabase.com/docs/guides/platform/billing-on-supabase)). Compute Nano: tối đa 0.5 GB RAM, CPU dùng chung ([Compute and Disk](https://supabase.com/docs/guides/platform/compute-and-disk); [pricing](https://supabase.com/pricing)).
- Read-only mode do **disk** chứ không phải quota 500 MB kích hoạt: khi disk đạt 95% thì DB chuyển read-only, lỗi `cannot execute INSERT in a read-only transaction`; dưới 95% thì tự tắt ([Database size](https://supabase.com/docs/guides/platform/database-size)). Disk gồm cả WAL và file phụ ([Database size](https://supabase.com/docs/guides/platform/database-size)).
- Vượt quota Free nói chung: được báo, có grace period (không nêu độ dài), sau đó có thể bị hạn chế: pause project, chuyển DB read-only, chặn tạo project, hoặc **trả 402 cho mọi API request**; gỡ khi quota làm mới đầu chu kỳ sau hoặc nâng Pro ([Billing FAQ](https://supabase.com/docs/guides/platform/billing-faq)).

**Có chạm không:** Không. Bài làm + đáp án dạng JSON vài KB/lượt; 100 học sinh × vài chục bài/năm chỉ ở mức vài chục MB. Rủi ro duy nhất là lưu ảnh/base64 hay lịch sử autosave không giới hạn trong DB.

### 1.3 Storage

- 1 GB file storage; file tối đa 50 MB ([pricing](https://supabase.com/pricing)). Giới hạn global áp cho mọi bucket, có thể đặt giới hạn riêng từng bucket nhưng không vượt global; với Free không vượt 50 MB ([File limits](https://supabase.com/docs/guides/storage/uploads/file-limits)).
- Image Transformations của Storage: **không có** trên Free ([pricing](https://supabase.com/pricing)).
- Backup DB **không** gồm object trong Storage, chỉ có metadata ([Backups](https://supabase.com/docs/guides/platform/backups)).
- Signed upload URL: `createSignedUploadUrl(path)` cho phép upload không cần xác thực thêm, URL hiệu lực 2 giờ; tạo URL cần quyền `insert` trên `storage.objects`; client dùng `uploadToSignedUrl(path, token, file)` ([JS reference, qua Context7 /websites/supabase](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl)).

**Có chạm không:** 50 MB/file: không (đề .docx thường vài MB). 1 GB: không ở quy mô này nếu ảnh được nén (ví dụ 200 đề × 5 MB = 1 GB là trần lý thuyết; nên nén ảnh khi import và có thể xoá file .docx gốc sau khi đã tách xong).

### 1.4 Egress (băng thông ra)

- 5 GB egress (uncached) + 5 GB cached egress mỗi tháng ([pricing](https://supabase.com/pricing); [Egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress)).
- Tính egress cho: Database (PostgREST), Auth, Storage, Edge Functions, Realtime, shared pooler, log drain ([Egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress)).
- Khuyến nghị giảm: select ít cột/dòng hơn, cache, insert/update không trả lại cả row ([Egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress)).

**Có chạm không:** Khó chạm. Ước tính: đề 20 ảnh × ~100 KB = ~2 MB/lượt làm bài; 400 lượt/tháng ≈ 0.8 GB. Autosave với `return=minimal` gần như không tốn egress. Chỉ chạm nếu ảnh không nén (ảnh chụp điện thoại 3–5 MB) hoặc tải lại cả đề mỗi lần autosave.

### 1.5 Kết nối / pooler

- Nano: 60 kết nối trực tiếp (giá trị khuyến nghị), 200 client kết nối qua pooler Supavisor, pool size mặc định 15 ([Compute and Disk](https://supabase.com/docs/guides/platform/compute-and-disk)). Trang pricing không ghi giới hạn kết nối riêng cho Free ([pricing](https://supabase.com/pricing)).

**Có chạm không:** Không, nếu app đi qua supabase-js (HTTP/PostgREST) hoặc pooler. Chỉ có rủi ro khi mở kết nối Postgres trực tiếp từ mỗi lần chạy serverless function mà không qua pooler.

### 1.6 Auth

- 50.000 MAU ([pricing](https://supabase.com/pricing)).
- Rate limit mặc định ([Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits)):
  - Email qua SMTP mặc định: **2 email/giờ** cho mỗi project.
  - Signup/recover/resend/magiclink/otp/user: 30 request / 5 phút theo IP (burst 30).
  - `/auth/v1/token` (đăng nhập bằng mật khẩu, refresh token, PKCE): 150 request / 5 phút theo IP (burst 30).
  - OTP: 60 giây giữa 2 lần gửi cho cùng user; verify: 30 / 5 phút theo IP.

**Có chạm không:** MAU: không. **Email 2/giờ: có**, nếu dùng mời qua email, xác nhận email hoặc quên mật khẩu cho 100 học sinh. **Rate limit theo IP: có thể**, vì cả lớp dùng chung một IP NAT của trường: 10 em đăng nhập cùng lúc vẫn dưới burst 30, nhưng một lớp 40 em đăng nhập cùng giây có thể chạm.

### 1.7 Edge Functions

- 500.000 invocation/tháng ([pricing](https://supabase.com/pricing)).
- 256 MB RAM, **2 giây CPU/request** (không tính I/O async), wall clock 150 giây trên Free, idle timeout 150 giây, bundle 20 MB (CLI) hoặc 5 MB, tối đa 100 function/project ([Edge Function limits](https://supabase.com/docs/guides/functions/limits)).

**Có chạm không:** Invocation: không. CPU 2 giây: **có thể** nếu phân tích .docx lớn (nhiều ảnh) trong Edge Function. Không nên đặt bước parse .docx ở đây.

### 1.8 Realtime

- 200 kết nối đồng thời peak, 2 triệu message/tháng ([pricing](https://supabase.com/pricing)).
- 100 message/giây, 100 channel join/giây, 100 channel/kết nối, payload broadcast 256 KB, payload postgres changes 1.024 KB; vượt thì bị từ chối join hoặc ngắt kết nối ([Realtime limits](https://supabase.com/docs/guides/realtime/limits)).

**Có chạm không:** Không (10 thí sinh + 1 màn hình giáo viên theo dõi). Autosave không cần Realtime.

### 1.9 Backup

- Daily backup tự động chỉ có ở Pro/Team/Enterprise; PITR là add-on của các gói trả phí ([Backups](https://supabase.com/docs/guides/platform/backups)). Pricing: Free không có automatic backups ([pricing](https://supabase.com/pricing)).
- Supabase khuyến nghị project Free tự export định kỳ bằng `supabase db dump` và giữ bản sao ngoài ([Backups](https://supabase.com/docs/guides/platform/backups)).
- Log API & Database giữ 1 ngày trên Free ([pricing](https://supabase.com/pricing)).

**Có chạm không:** Có. Đây là điểm yếu thật: không có backup nào nếu lỡ xoá nhầm dữ liệu điểm.

### 1.10 Số project free

- Tối đa 2 project active ([pricing](https://supabase.com/pricing); [Free plan](https://supabase.com/docs/guides/platform/free-plan)).

**Có chạm không:** Không, nếu dùng 1 project production + chạy Supabase local bằng CLI để dev; project thứ 2 có thể làm staging.

---

## 2. Vercel — gói Hobby

### 2.1 Điều khoản phi thương mại

- Terms (cập nhật 19/10/2026): "Bạn chỉ được dùng Dịch vụ theo gói Hobby cho mục đích cá nhân hoặc phi thương mại" ([Vercel Terms](https://vercel.com/legal/terms)). Bản Terms hiện hành **không định nghĩa** "commercial".
- Trang Fair Use Guidelines hiện hành cũng **không còn** đoạn định nghĩa commercial; chỉ liệt kê ví dụ fair use (static site, app hybrid, "Functions that query DBs or APIs", ...) và các trường hợp không bao giờ fair use (proxy/VPN, hot-link media, scraper, đào coin, load test/pentest trái phép) ([Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines)).
- Định nghĩa trước đây (do nhân viên Vercel trích từ Fair Use Guidelines ngày 25/09/2025): "Commercial usage is defined as any Deployment that is used for the purpose of financial gain of anyone involved"; cùng nhân viên đó trả lời project cho tổ chức phi lợi nhuận và không ai được trả tiền thì không có vấn đề commercial ([Vercel Community](https://community.vercel.com/t/question-about-commercial-usage/23321)). Đây là phản hồi của nhân viên trên diễn đàn, không phải văn bản pháp lý.

**Có chạm không:** Một giáo viên tự làm công cụ miễn phí cho học sinh của mình, không thu phí, không quảng cáo, không ai được trả tiền để viết app: phù hợp "personal or non-commercial" theo cách đọc hợp lý và theo phản hồi của nhân viên Vercel. **Sẽ thành vùng rủi ro** nếu: trung tâm luyện thi thu học phí dùng nó, trường thuê/đặt làm, hoặc bán cho giáo viên khác. Khi đó chuyển Pro hoặc hỏi Vercel Support trước.

### 2.2 Function: body request, thời gian chạy, bộ nhớ

- Body request hoặc response tối đa **4,5 MB**; vượt thì trả `413 FUNCTION_PAYLOAD_TOO_LARGE` (response dạng streaming không bị giới hạn) ([Functions limitations](https://vercel.com/docs/functions/limitations)).
- Max duration Hobby: 300 giây (mặc định cũng là tối đa); quá thì 504 `FUNCTION_INVOCATION_TIMEOUT` ([Functions limitations](https://vercel.com/docs/functions/limitations); [Limits](https://vercel.com/docs/limits)).
- Bộ nhớ Hobby: 2 GB / 1 vCPU (mặc định cũng là tối đa); bundle 250 MB ([Functions limitations](https://vercel.com/docs/functions/limitations)).
- Region mặc định `iad1`, có thể đổi region mặc định; nhiều region chỉ có ở Pro/Enterprise ([Functions limitations](https://vercel.com/docs/functions/limitations)).
- Vercel tự khuyến nghị: với file > 4,5 MB, cho trình duyệt upload thẳng lên storage và server chỉ cấp token, nhớ xác thực người dùng trước khi cấp ([KB bypass 4.5MB](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions)).

**Có chạm không:** 4,5 MB: **có**, nếu .docx có ảnh được POST qua Server Action/Route Handler (Server Action của Next.js còn có giới hạn body mặc định riêng, chưa kiểm chứng trong đợt này). 300 giây và 2 GB: không, với việc parse một file .docx.

### 2.3 Lưu lượng hàng tháng (vượt là bị dừng, không tính tiền)

Hobby được cấp mỗi tháng ([Hobby plan](https://vercel.com/docs/plans/hobby); [Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines)):

| Tài nguyên | Hobby |
|---|---|
| Fast Data Transfer | 100 GB |
| Fast Origin Transfer | 10 GB |
| CDN Requests (trước đây gọi là Edge Requests) | 1.000.000 |
| Function Invocations | 1.000.000 |
| Active CPU | 4 CPU-giờ |
| Provisioned Memory | 360 GB-giờ |
| Image Transformations / Cache Reads / Cache Writes | 5.000 / 300.000 / 100.000 |

- Khi vượt: "trong đa số trường hợp... bạn sẽ phải đợi 30 ngày trước khi dùng lại tính năng đó" ([Hobby plan](https://vercel.com/docs/plans/hobby)). Dùng vượt kéo dài có thể dẫn đến deployment bị pause; project resume thủ công, không tự động ([KB paused](https://vercel.com/kb/guide/why-is-my-account-deployment-blocked)). Terms cho phép Vercel chấm dứt tài khoản nếu vượt giới hạn ([Vercel Terms](https://vercel.com/legal/terms) §19.1). "Lách" giới hạn của Vercel là vi phạm fair use ([Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines)).
- Active CPU chỉ tính thời gian CPU thực; thời gian chờ I/O (truy vấn DB) không tính ([Functions limitations](https://vercel.com/docs/functions/limitations)).
- Runtime log chỉ giữ 1 giờ trên Hobby ([Limits](https://vercel.com/docs/limits)).

**Có chạm không:** Ở quy mô này thì không, **với điều kiện autosave không đi qua Vercel Function**. Kịch bản xấu: 100 em × 8 bài/tháng × 45 phút × autosave mỗi 5 giây ≈ 430.000 invocation chỉ riêng autosave, cộng SSR và prefetch thì tiến gần 1 triệu. Vượt nghĩa là app chết tới 30 ngày, có thể giữa kỳ kiểm tra. Hậu quả quá nặng so với lợi ích.

### 2.4 Cron trên Hobby

- Cron Jobs (tính năng legacy, sẽ chuyển sang Schedules): 100 job/project, **tối đa 1 lần/ngày**, độ chính xác theo giờ (±59 phút); biểu thức chạy nhiều hơn 1 lần/ngày sẽ làm deploy thất bại ([Cron usage & pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)).
- Vercel Schedules (beta): trên Hobby chạy dày nhất mỗi 15 phút (jitter cố định 15 phút), 100 schedule tĩnh/deployment, tối đa 500 schedule động và **5.000 lần chạy** mỗi chu kỳ; vượt thì các lần chạy bị bỏ qua tới chu kỳ sau; giới hạn có thể đổi trước GA ([Schedules limits](https://vercel.com/docs/schedules/limits)).
- Mỗi lần chạy cron/schedule là một Function invocation, tính vào quota ở mục 2.3 ([Cron usage & pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing); [Schedules limits](https://vercel.com/docs/schedules/limits)).

**Có chạm không:** Có, nếu định dùng cron để tự nộp bài khi hết giờ: không thể (sai lệch ±59 phút hoặc ±15 phút). Keep-alive cho Supabase thì dùng được: cron 1 lần/ngày, hoặc Schedule vài giờ một lần (khoảng 180 lần/tháng, rất xa mức 5.000).

### 2.5 Image Optimization (`next/image`)

- Hobby: 5.000 transformation, 300.000 cache read, 100.000 cache write mỗi tháng. Vượt thì ảnh **mới** trả lỗi 402 (hiện alt text), ảnh đã cache vẫn chạy; không bị tính tiền ([Image Optimization limits](https://vercel.com/docs/image-optimization/limits-and-pricing)).
- Mỗi cache MISS/STALE là một transformation; ảnh nguồn tối đa 8192 px; chỉ tối ưu JPEG/PNG/WebP/AVIF ([Image Optimization limits](https://vercel.com/docs/image-optimization/limits-and-pricing)).

**Có chạm không:** Có thể, nếu render mọi ảnh trong đề qua `next/image` (nhiều đề × nhiều ảnh × nhiều kích thước/thiết bị). Ảnh trong đề nên được tối ưu sẵn khi import và hiển thị bằng `<img>` thường (hoặc `unoptimized`).

### 2.6 Giới hạn khác (ít ảnh hưởng)

- 100 deployment/ngày, build 45 phút, 1 build đồng thời ([Limits](https://vercel.com/docs/limits)).
- Hobby không kết nối được với repo thuộc GitHub Organization; dùng repo cá nhân ([Limits](https://vercel.com/docs/limits)).

---

## 3. Bảng tổng hợp

| Giới hạn | Có chạm không (≤100 HS, ≤10 đồng thời) | Giảm thiểu |
|---|---|---|
| Supabase pause sau 1 tuần không hoạt động | **Có**, vào kỳ nghỉ | Job keep-alive vài lần/ngày gọi một truy vấn thật qua REST (GitHub Actions hoặc Vercel cron/Schedule); không có văn bản cấm nhưng cũng không bảo đảm. Dự phòng: email cảnh báo đến trước ~1 tuần, resume thủ công trong 1 năm, dữ liệu vẫn còn |
| Supabase không có backup trên Free | **Có** (rủi ro mất dữ liệu) | GitHub Action định kỳ chạy `supabase db dump` (kiêm keep-alive) + sao chép bucket Storage; cho phép xuất điểm ra CSV/Excel |
| DB 500 MB / read-only ở 95% disk | Không | Không lưu ảnh/base64 trong DB; autosave ghi đè 1 dòng/lượt làm bài (upsert), không append lịch sử vô hạn |
| Storage 1 GB, file ≤ 50 MB, không có image transform | Không (nếu nén ảnh) | Nén/resize ảnh sang WebP khi import (phía trình duyệt); đặt giới hạn size + MIME cho bucket; xoá .docx gốc sau khi tách nếu không cần |
| Egress 5 GB + 5 GB cached | Không | Ảnh đã nén; header cache dài cho ảnh đề; autosave `return=minimal`; chỉ select cột cần |
| Kết nối DB (60 trực tiếp / 200 pooler) | Không | Dùng supabase-js (HTTP) hoặc pooler; không mở kết nối Postgres trực tiếp trong mỗi lần chạy function |
| Auth: email 2/giờ (SMTP mặc định) | **Có**, nếu dùng email mời/xác nhận/reset | Giáo viên tạo tài khoản bằng Admin API (service role, `email_confirm: true`), không gửi email; giáo viên reset mật khẩu; hoặc cấu hình SMTP riêng |
| Auth: rate limit theo IP (token 150/5 phút, burst 30) | Ít, nhưng có thể khi cả lớp chung IP NAT | 10 em thì ổn; khi scale thì tăng giới hạn trong dashboard (doc ghi "Defaults to"), để học sinh đăng nhập lệch nhau vài phút trước giờ thi |
| Edge Functions (CPU 2 giây, 256 MB) | Có thể, nếu parse .docx ở đây | Không parse .docx trong Edge Function; parse ở trình duyệt hoặc Vercel Function |
| Realtime (200 kết nối, 2M message) | Không | Chỉ dùng cho màn hình theo dõi của giáo viên (tuỳ chọn) |
| 2 project Free | Không | 1 prod + Supabase local (CLI) cho dev |
| Vercel Hobby phi thương mại | Không (giáo viên tự làm, miễn phí, không ai được trả tiền) | Nếu có thu phí/trường đặt làm/trung tâm: chuyển Pro hoặc hỏi Vercel Support trước |
| Vercel body 4,5 MB | **Có**, nếu upload .docx qua function | `createSignedUploadUrl` (server, sau khi kiểm tra quyền giáo viên) → trình duyệt `uploadToSignedUrl` thẳng lên Supabase Storage; hoặc parse .docx ngay ở trình duyệt và chỉ gửi JSON + ảnh đã nén |
| Vercel max duration 300 giây / 2 GB | Không | Parse ở trình duyệt; nếu parse ở server thì đọc file từ Storage, không nhận qua body |
| Vercel 1M invocation, 4 CPU-giờ, 360 GB-giờ (vượt là dừng tới 30 ngày) | Không, **trừ khi autosave đi qua Vercel** | Autosave gọi thẳng Supabase từ trình duyệt (RLS hoặc RPC); debounce theo thay đổi (2–5 giây) + nhịp tối thiểu 15–30 giây; trang làm bài là client component, không SSR lại liên tục |
| Vercel cron 1 lần/ngày, ±59 phút (Schedules: 15 phút, 5.000 lần/chu kỳ) | **Có**, nếu dùng cron để tự nộp bài | Không dùng cron cho logic thời gian: lưu `deadline` ở server, chặn ghi sau deadline bằng RLS/RPC, chấm "nộp lười" khi mở/đọc lượt làm bài |
| Vercel Image Optimization 5.000 transform/tháng | Có thể | Ảnh đề dùng `<img>` trỏ tới Storage (đã nén sẵn); `next/image` chỉ cho ảnh tĩnh của giao diện |
| Log runtime 1 giờ (Vercel), log 1 ngày (Supabase) | Có (gây khó debug) | Ghi sự kiện quan trọng (nộp bài, lỗi autosave) vào một bảng `events` trong DB |

## 4. Hệ quả thiết kế chính

1. **Đường nóng (hot path) không đi qua Vercel.** Autosave và nộp bài nên gọi thẳng Supabase từ trình duyệt (PostgREST/RPC + RLS). Vercel chỉ phục vụ UI và vài thao tác quản trị. Lý do: quota Hobby mà vượt thì bị dừng tới 30 ngày, còn quota Supabase dư rất xa ở quy mô này. Nhờ đó tải đề và autosave không phụ thuộc giới hạn function.
2. **Upload .docx không đi qua body của function.** Upload bằng signed upload URL của Supabase Storage (hiệu lực 2 giờ, server cấp sau khi kiểm tra là giáo viên), hoặc parse .docx ngay trên trình duyệt rồi lưu JSON câu hỏi + ảnh WebP đã nén. Cách parse ở trình duyệt còn tránh luôn giới hạn CPU của Edge Function và Active CPU của Vercel.
3. **Thời gian làm bài do server quyết định, không dựa vào cron.** Lưu `started_at`/`deadline` trong DB; RPC `save_answer`/`submit` từ chối ghi sau `deadline` (+ vài giây dung sai); lượt quá hạn được chốt khi có người đọc tới (học sinh mở lại, giáo viên xem điểm). Cron trên Hobby không đủ chính xác cho việc này.
4. **Vận hành bù cho những gì Free không có:** một GitHub Action định kỳ vừa `supabase db dump` + sao lưu Storage ra nơi khác, vừa đóng vai keep-alive. Chấp nhận rằng project vẫn có thể bị pause vào kỳ nghỉ, nên viết hướng dẫn resume cho giáo viên (dữ liệu vẫn giữ trong 1 năm).
5. **Tài khoản học sinh không cần email.** Giáo viên tạo tài khoản hàng loạt qua Admin API (chạy server-side, service role) với email giả/định danh nội bộ đã xác nhận sẵn. Cách này né giới hạn 2 email/giờ và không phụ thuộc email thật của học sinh.
6. **Ảnh được tối ưu một lần khi import**, không tối ưu khi xem: Supabase Free không có image transform, còn `next/image` trên Hobby chỉ có 5.000 transform/tháng.
7. **Đường nâng cấp rõ ràng:** khi có thu phí hoặc quy mô lớn hơn thì chuyển Vercel Pro ($20/người/tháng theo [Hobby plan](https://vercel.com/docs/plans/hobby)) và Supabase Pro (có backup hằng ngày, không bị pause). Kiến trúc trên không cần đổi.

## 5. Chưa kiểm chứng / còn mở

- Ngưỡng "đủ hoạt động" để Supabase không pause, và việc request tự động có được tính hay không: tài liệu không nêu.
- Độ dài grace period khi vượt quota Supabase Free: tài liệu không nêu ([Billing FAQ](https://supabase.com/docs/guides/platform/billing-faq)).
- Giới hạn body mặc định của Next.js Server Actions (khác với giới hạn 4,5 MB của Vercel): chưa tra trong đợt này.
- Rate limit Auth tính theo IP nào khi đăng nhập được gọi từ server Vercel (SSR) thay vì từ trình duyệt: chưa kiểm chứng. Nên đăng nhập từ trình duyệt.
