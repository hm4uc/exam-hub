# Exam Hub

Web kiểm tra trực tuyến cho một giáo viên Toán: tải đề Word → hệ thống tách câu hỏi, đáp án, lời giải, công thức → giao cho lớp bằng link → học sinh đăng nhập làm bài, chấm tự động → bảng điểm, xuất Excel.

- Spec: [.scratch/exam-hub/spec.md](.scratch/exam-hub/spec.md) · Bản đồ quyết định: [.scratch/exam-hub/map.md](.scratch/exam-hub/map.md) · Thuật ngữ: [CONTEXT.md](CONTEXT.md)
- Stack: Next.js 16 · Supabase (Postgres, Auth, Storage, pg_cron) · Tailwind 3 · KaTeX · chạy miễn phí trên Vercel Hobby + Supabase Free.

## Cài đặt lần đầu

1. Tạo file `.env.deploy` ở thư mục gốc (đã được git bỏ qua, **không gửi file này cho ai**):

   ```
   SUPABASE_ACCESS_TOKEN=sbp_...
   SUPABASE_PROJECT_REF=abcdefghijklmnop
   VERCEL_TOKEN=...
   ```

2. Chạy lần lượt:

   ```bash
   npm install
   node scripts/setup-supabase.mjs                                  # khoá API → .env.local, cấu hình Auth, chạy migration
   node scripts/create-teacher.mjs <tên-đăng-nhập> "<Họ tên>" <mật-khẩu>
   node scripts/deploy-vercel.mjs                                   # lần đầu: tạo project Vercel + biến môi trường (sau đó deploy qua CI/CD)
   ```

## CI/CD

| Khi nào | Chạy gì |
|---|---|
| Mở PR, push nhánh khác `main` | **CI** (`.github/workflows/ci.yml`): lint, typecheck, test (gồm test CSDL trên PGlite), build |
| Push / merge vào `main` | **Deploy** (`deploy.yml`): CI → chạy migration mới lên Supabase → build và deploy Vercel production → thử trang và toàn luồng làm bài trên CSDL thật (`smoke-test.mjs`, tự dọn dữ liệu thử) |
| Hằng tuần | **Dependabot** mở PR cập nhật thư viện (bản nhỏ gộp một PR, bản lớn tách riêng) |

Bước nào lỗi thì dừng ở đó: code lỗi không lên production. Vercel không tự deploy khi push nữa (`vercel.json` → `git.deploymentEnabled: false`); chỉ GitHub Actions deploy. Chạy lại tay: tab **Actions** → **Deploy** → **Run workflow**.

**Secret cần có** (GitHub → Settings → Secrets and variables → Actions → New repository secret):

| Tên | Lấy ở đâu |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | supabase.com/dashboard/account/tokens |
| `VERCEL_TOKEN` | vercel.com/account/settings/tokens (không đặt hạn, hoặc nhớ gia hạn) |

Migration mới: thêm file `supabase/migrations/<thời gian>_<tên>.sql`. Chỉ thêm, không sửa file đã chạy; nên viết sao cho bản code cũ vẫn chạy được (thêm cột, thêm hàm), vì migration chạy trước khi bản mới lên.

## Phát triển

```bash
npm run dev        # http://localhost:3000 (cần .env.local)
npm test           # test bộ phân giải đề + test CSDL trên PGlite
npm run typecheck
```

> **Windows:** chạy `npm run build` / `npm run dev` trong thư mục mở bằng chữ ổ đĩa **viết hoa** (`D:\Development\exam-hub`). Nếu terminal đang ở `d:\…` (chữ thường), Next.js nạp React hai lần và build báo lỗi `Cannot read properties of null (reading 'useContext')`.

## Cấu trúc

Chia lớp theo hướng clean architecture: phụ thuộc chỉ đi từ ngoài vào trong (`app` → `features` → `server` / `domain`). `domain` không biết gì về Next.js hay Supabase.

| Đường dẫn | Lớp | Nội dung |
|---|---|---|
| `src/domain/exam/` | Domain | Logic thuần: phân giải .docx, OMML/công thức chữ → LaTeX, render KaTeX, kiểu dữ liệu, kiểm tra câu hỏi |
| `src/server/` | Hạ tầng | Client Supabase (trình duyệt / server / service role), phiên đăng nhập `getMe`, `requireTeacher`, `requireStudent` |
| `src/features/<tính năng>/` | Ứng dụng | Server Action + giao diện riêng của từng nghiệp vụ: `auth`, `exams` (tải, soát, sửa đề), `assignments` (giao bài, bảng điểm), `attempt` (học sinh làm bài), `roster` (lớp, học sinh) |
| `src/components/` | Giao diện chung | `ui.tsx` (nút, ô nhập, thẻ…), `shell/` (thanh trên, menu, logo), `theme-switch` (Sáng / Tối / Theo máy) |
| `src/lib/` | Tiện ích | Định dạng ngày giờ, điểm; thông báo lỗi RPC |
| `src/app/` | Định tuyến | Chỉ `page` / `layout` / `loading`: đọc dữ liệu rồi ghép component từ `features` |
| `supabase/migrations/`, `supabase/tests/` | CSDL | Schema, RLS, RPC làm bài, chấm điểm, pg_cron; test trên PGlite |
| `scripts/` | Vận hành | Cài đặt Supabase, tạo giáo viên, deploy Vercel, `smoke-test.mjs` (thử toàn luồng trên project thật) |
