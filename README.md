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
   node scripts/deploy-vercel.mjs                                   # lần đầu: tạo project Vercel + biến môi trường (sau đó chỉ cần push lên main)
   ```

## Deploy

- Push lên `main` → Vercel tự build và deploy production (Vercel đã nối với repo GitHub).
- GitHub Actions (`.github/workflows/ci.yml`) chạy lint, typecheck, test, build ở mỗi lần push/PR để báo lỗi; không chặn deploy.
- Dependabot mở PR cập nhật thư viện hằng tuần.
- Migration CSDL **không** tự chạy: khi thêm file vào `supabase/migrations/`, chạy `node scripts/setup-supabase.mjs --only=migrate` (cần `.env.deploy`) trước khi push code dùng đến nó.

### Quy trình phát hành (khuyến nghị)

Mọi thay đổi đi qua nhánh + Pull Request, không đẩy thẳng lên `main`:

1. Làm trên nhánh `feat/…`; Vercel tự tạo bản **Preview** cho nhánh để thử trước.
2. Mở PR; CI (lint, typecheck, test, build) phải xanh.
3. Nếu có file mới trong `supabase/migrations/`: chạy migration lên Supabase **staging** → thử → rồi lên production **trước khi** merge.
4. Merge PR vào `main` (Vercel deploy production).

Để quy trình này được **ép buộc** (cần làm một lần trên GitHub, repo Settings → Branches → Add rule cho `main`): bật *Require a pull request before merging* và *Require status checks to pass* (chọn job "Lint, typecheck, test, build"), bỏ quyền push thẳng. Nên tạo thêm một project Supabase thứ hai làm staging (gói Free cho 2 project) với biến môi trường riêng cho Preview.

### Sao lưu và khôi phục

`.github/workflows/backup.yml` chạy mỗi ngày 02:30 (giờ VN): dump Postgres (schema `public` + `auth`) và tải hai bucket Storage, nén, **mã hoá bằng mật khẩu** rồi lưu thành artifact 30 ngày. Cần đặt secret cho repo: `SUPABASE_DB_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BACKUP_PASSPHRASE` (cất mật khẩu này ở nơi an toàn, mất là không giải mã được). Bấm *Run workflow* một lần để kiểm tra.

Khôi phục (nên thử vào project staging trước, chưa thử trên dữ liệu thật):

```bash
gpg --decrypt exam-hub-YYYYMMDD.tar.gz.gpg | tar -xz        # ra db.dump và thư mục storage/
pg_restore --no-owner --clean --if-exists -d "<chuỗi kết nối>" db.dump
# ảnh/đề gốc: tải lại các file trong storage/<bucket>/… lên đúng bucket cùng đường dẫn
```

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
