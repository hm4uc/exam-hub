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
   node scripts/deploy-vercel.mjs                                   # đặt biến môi trường + deploy production
   ```

## Phát triển

```bash
npm run dev        # http://localhost:3000 (cần .env.local)
npm test           # test bộ phân giải đề + test CSDL trên PGlite
npm run typecheck
```

> **Windows:** chạy `npm run build` / `npm run dev` trong thư mục mở bằng chữ ổ đĩa **viết hoa** (`D:\Development\exam-hub`). Nếu terminal đang ở `d:\…` (chữ thường), Next.js nạp React hai lần và build báo lỗi `Cannot read properties of null (reading 'useContext')`.

## Cấu trúc

| Đường dẫn | Nội dung |
|---|---|
| `supabase/migrations/` | Schema, RLS, RPC làm bài, chấm điểm, chấm lại, pg_cron |
| `supabase/tests/` | Test SQL chạy trên PGlite (Postgres WASM) |
| `src/lib/exam/` | Phân giải .docx, OMML/công thức chữ → LaTeX, render KaTeX |
| `src/app/(auth)` | Đăng nhập, đăng ký, đổi mật khẩu |
| `src/app/(hs)` | Học sinh: trang chủ, `/{mã}` bài giao, `/lam` làm bài, `/ket-qua` |
| `src/app/gv` | Giáo viên: đề thi, giao bài, bảng điểm, lớp, học sinh |
| `scripts/` | Cài đặt Supabase, tạo giáo viên, deploy Vercel, tạo file Word mẫu |
