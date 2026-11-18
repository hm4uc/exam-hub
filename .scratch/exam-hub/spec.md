# Spec MVP: Exam Hub

Ngày chốt: 2026-11-18. Nguồn quyết định: [map.md](map.md) và các phiếu trong `issues/`. Thuật ngữ theo [CONTEXT.md](../../CONTEXT.md).

## 1. Mục tiêu

Một giáo viên Toán tải file Word đề lên → hệ thống phân giải thành Đề thi (3 Dạng câu, có đáp án, lời giải, công thức hiển thị chuẩn) → giáo viên giao cho Lớp qua link → học sinh đăng nhập, làm bài có giờ, được chấm tự động → giáo viên xem bảng điểm, xuất Excel.

Ràng buộc: chi phí 0đ (Supabase Free + Vercel Hobby); dưới 100 học sinh, tối đa 10 em làm cùng lúc, không chặn đường scale; chạy được trên mọi thiết bị phổ biến kể cả trình duyệt trong Zalo/Messenger; giao diện đơn giản, đẹp, thân thiện (tham khảo impeccable).

Ngoài phạm vi MVP: phân giải PDF/ảnh bằng AI, tự luận, nhiều giáo viên, ngân hàng câu hỏi, giám sát camera, app native, sửa công thức MathType trên web.

## 2. Người dùng và luồng chính

**Giáo viên** (một tài khoản, tạo bằng script lúc cài đặt)
1. Tải `.docx` → màn xem trước: từng câu với dạng câu, đáp án, nguồn đáp án, lời giải; câu lỗi báo đỏ. Sửa trực tiếp nội dung, đáp án, điểm. Lưu nháp. Xuất bản khi hết lỗi.
2. Quản lý Lớp (tạo, đổi tên, lưu trữ) và Học sinh (xếp lớp, chuyển lớp, sửa họ tên, đặt lại mật khẩu, khoá).
3. Giao bài: chọn Đề thi + Lớp + cấu hình → nhận link `/{code}` để gửi qua Zalo.
4. Theo dõi Bài giao: ai đã làm, đang làm, điểm, số lần rời tab; xem từng Bài làm; xuất Excel.
5. Sửa đáp án của Đề đã có Bài làm → hệ thống chấm lại và báo "đã chấm lại N bài".

**Học sinh**
1. Mở link Bài giao → chưa đăng nhập thì đăng nhập hoặc đăng ký (họ tên, tên đăng nhập, mật khẩu). Đăng ký qua link của Bài giao thì được xếp tạm vào Lớp của Bài giao đó nếu chưa có lớp.
2. Màn Bài giao: tên bài, thời gian, số lượt còn lại, giờ mở/đóng, mật khẩu (nếu có) → Bắt đầu.
3. Làm bài: mỗi màn một câu, danh sách số câu ở trên câu hỏi, đồng hồ, "Đã lưu", nộp bài có xác nhận. Mất mạng/tắt app → mở lại (kể cả máy khác) tiếp tục đúng chỗ.
4. Kết quả theo chế độ xem kết quả của Bài giao.
5. Trang chủ: các Bài giao của lớp mình (đang mở, sắp mở, đã làm + điểm nếu được xem).

## 3. Quy ước file Word (phiếu 06)

- Câu bắt đầu bằng `Câu n:` hoặc `Câu n.`; tiêu đề `PHẦN I/II/III` tuỳ chọn; dòng `HẾT` ngăn đề với phần đáp án.
- Dạng câu nhận theo cấu trúc: có `A.`–`D.` (mỗi dòng một phương án hoặc chung một dòng cách bằng tab) → Trắc nghiệm; có `a)`–`d)` → Đúng/Sai; không có cả hai → Trả lời ngắn.
- Đáp án từ 3 nguồn, phải khớp nhau: `BẢNG ĐÁP ÁN` (`1.A  11.ĐSĐS  15.0,7  16.0,33|0,3`), dòng `Câu n: Đáp án X.` trong `HƯỚNG DẪN GIẢI`, gạch chân/tô đỏ phương án hoặc ý đúng. Mâu thuẫn hoặc thiếu → lỗi ở câu đó.
- Lời giải: `HƯỚNG DẪN GIẢI CHI TIẾT` → `Câu n: …`, lưu theo từng câu.
- Hình PNG/JPG giữ nguyên; EMF/WMF → PNG; hình vẽ bằng Shapes → lỗi "dán lại thành ảnh".
- Có file Word mẫu tải về ngay trên màn tải đề.

## 4. Công thức toán (phiếu 01, 03, 10)

- Biểu diễn lưu trữ: văn bản xen LaTeX trong `\( … \)`, ảnh bằng token `⟦img:<storage-path>⟧`.
- Nguồn → LaTeX: Equation của Word (OMML) bằng bộ chuyển tự viết; công thức gõ bằng chữ (`π/6`, `√3`, `sin²x`, `<=`) nhận theo cụm biểu thức; `$…$` giữ nguyên; MathType → ảnh xem trước (WMF/EMF → PNG) [phiếu T13].
- Render: KaTeX (ghim phiên bản) ở server khi lưu câu hỏi, `\displaystyle`, output `htmlAndMathml`; lưu `*_html` cạnh nguồn. Trang làm bài chỉ tải CSS + font KaTeX. Nâng KaTeX → chạy lại render cho mọi câu.
- Màn xem trước của giáo viên cho sửa nguồn (văn bản + LaTeX) và xem trước ngay.

## 5. Chấm điểm (phiếu 05)

- Mặc định theo Bộ: trắc nghiệm 0,25; Đúng/Sai tối đa 1 theo số ý đúng 1→0,1, 2→0,25, 3→0,5, 4→1 (nhân theo điểm câu); trả lời ngắn 0,5. Sửa được điểm theo Phần và theo từng câu.
- "Quy về thang 10" bật mặc định: điểm = đạt / tối đa × 10. Hiển thị 2 chữ số thập phân.
- Trả lời ngắn so theo giá trị số (phẩy/chấm, số âm, không phân số), nhiều đáp án chấp nhận.
- Chấm trong Postgres (hàm `grade_attempt`). Sửa đáp án/điểm → chấm lại mọi Bài làm đã nộp của Đề.

## 6. Kiến trúc (phiếu 02, 03, 08)

- **Next.js 16** (App Router, TypeScript, Server Actions) trên **Vercel Hobby**. **Tailwind CSS 3.4**. Font Be Vietnam Pro qua `next/font` (tự host). Browserslist: Safari/iOS ≥ 15.4, Chrome ≥ 109, Firefox ≥ 115, Samsung ≥ 21; máy cũ hơn → trang "thiết bị chưa hỗ trợ".
- **Supabase**: Postgres (RLS + hàm RPC), Auth (email/mật khẩu với email nội bộ `<username>@hs.local`, không gửi thư), Storage (file đề gốc, ảnh câu hỏi), `pg_cron` (chốt Bài làm quá hạn mỗi phút).
- **Học sinh không đọc thẳng bảng** `questions`/`attempts`: mọi thao tác qua RPC `SECURITY DEFINER` gọi thẳng từ trình duyệt (không qua Vercel Function). Phía giáo viên dùng RLS (`role = 'teacher'`).
- **Phiên vĩnh viễn**: refresh token không hạn; `@supabase/ssr` đặt cookie từ server, `maxAge` 400 ngày, gia hạn mỗi lần vào trang (middleware). Mất phiên chỉ khi Đăng xuất, giáo viên khoá tài khoản hoặc đặt lại mật khẩu (thu hồi phiên).
- **Phân giải `.docx` trên trình duyệt giáo viên** (Web Worker, JSZip + parser TS). Ảnh → Supabase Storage bằng signed upload URL. Server Action kiểm tra JSON (zod), render KaTeX, lưu nháp.
- **Tự lưu**: đổi câu trả lời → debounce 800 ms → `save_answers`; thêm khi `visibilitychange(hidden)`/`pagehide` bằng `fetch keepalive`. localStorage chỉ là bản nháp đệm. Đồng hồ tính từ `deadline_at` và độ lệch giờ server.
- **Đếm rời tab**: `visibilitychange` + `blur`, gửi kèm `save_answers`; hiển thị "tham khảo".
- **Sao lưu + giữ Supabase hoạt động**: GitHub Actions hằng ngày `pg_dump` + tải Storage → repo GitHub riêng tư.

## 7. Mô hình dữ liệu

```sql
classes(id uuid pk, name text not null, school_year text, archived_at timestamptz, created_at timestamptz default now(),
        unique(name, school_year))

profiles(id uuid pk references auth.users on delete cascade,
         role text not null check (role in ('teacher','student')),
         username text not null, -- unique index on lower(username); ^[a-z0-9._]{3,30}$
         full_name text not null,
         class_id uuid references classes on delete set null,
         is_locked boolean not null default false,
         must_change_password boolean not null default false,
         created_at timestamptz not null default now())

exams(id uuid pk, title text not null, source_path text, status text not null default 'draft' check (status in ('draft','published')),
      scoring jsonb not null default '{"mcq":0.25,"tf":1,"short":0.5,"scale10":true}',
      created_at, updated_at)

questions(id uuid pk, exam_id uuid not null references exams on delete cascade, position int not null, part text,
          type text not null check (type in ('mcq','tf','short')),
          stem text not null, stem_html text not null,
          choices jsonb not null default '[]',   -- [{label, text, html}] (A–D hoặc a–d)
          answer jsonb not null,                 -- mcq "B" | tf "ĐSĐS" | short ["0,33","0,3"]
          solution text, solution_html text, points numeric,  -- null = theo exams.scoring
          unique(exam_id, position))

assignments(id uuid pk, code text not null unique, exam_id uuid not null references exams on delete restrict,
            class_id uuid not null references classes on delete restrict, title text not null,
            opens_at timestamptz not null, closes_at timestamptz not null, duration_minutes int not null check (duration_minutes > 0),
            max_attempts int not null default 1, shuffle_questions boolean not null default true, shuffle_choices boolean not null default true,
            password_hash text, result_mode text not null default 'score' check (result_mode in ('none','score','score_answers')),
            result_release text not null default 'on_submit' check (result_release in ('on_submit','after_close')),
            created_at timestamptz not null default now(), check (closes_at > opens_at))

attempts(id uuid pk, assignment_id uuid not null references assignments on delete cascade,
         student_id uuid not null references profiles on delete cascade, attempt_no int not null,
         started_at timestamptz not null default now(), deadline_at timestamptz not null, submitted_at timestamptz,
         question_order uuid[] not null, choice_orders jsonb not null default '{}',
         answers jsonb not null default '{}', tab_leaves int not null default 0, last_seen_at timestamptz,
         score_raw numeric, score_max numeric, score numeric(5,2), per_question jsonb,
         unique(assignment_id, student_id, attempt_no))
-- index: attempts(assignment_id), attempts(student_id), attempts(deadline_at) where submitted_at is null
```

**RLS**: bật cho mọi bảng. Giáo viên: toàn quyền (hàm `is_teacher()`). Học sinh: `profiles` chỉ dòng của mình (đọc; sửa `full_name`); `classes` đọc lớp của mình; `assignments` đọc của lớp mình (không có `password_hash`, qua view); `exams/questions/attempts`: không có quyền trực tiếp.

**RPC học sinh** (`security definer`, kiểm `auth.uid()`, không khoá, đúng lớp):
- `assignment_info(code)` → thông tin Bài giao + số lượt đã dùng + trạng thái (chưa mở / đang mở / đã đóng / hết lượt).
- `start_attempt(code, password)` → tạo hoặc tiếp tục lượt đang dở; trả câu hỏi đã bỏ `answer`/`solution` theo thứ tự đảo riêng, câu trả lời đã lưu, `deadline_at = least(now() + duration, closes_at)`, `server_now`.
- `save_answers(attempt_id, patch jsonb, tab_leaves int)` → từ chối nếu đã nộp hoặc quá `deadline_at` + 30 s.
- `submit_attempt(attempt_id)` → chấm, đặt `submitted_at`, trả kết quả theo chế độ xem kết quả.
- `attempt_result(attempt_id)` → kết quả khi được phép xem.
- `register_student(...)` chạy ở Server Action bằng service role (tạo user + profile, xếp lớp tạm).

**Hàm nội bộ**: `grade_attempt(id)`, `finalize_expired()` (pg_cron mỗi phút), trigger chấm lại khi `questions.answer/points` hoặc `exams.scoring` đổi.

## 8. Màn hình

| Đường dẫn | Ai | Nội dung |
|---|---|---|
| `/dang-nhap`, `/dang-ky`, `/doi-mat-khau` | mọi người | Đăng nhập / đăng ký / đổi mật khẩu (bắt buộc sau khi bị đặt lại) |
| `/` | học sinh | Bài giao của lớp mình |
| `/{code}` | học sinh | Thông tin Bài giao → Bắt đầu / Tiếp tục / Xem kết quả |
| `/{code}/lam` | học sinh | Làm bài |
| `/{code}/ket-qua` | học sinh | Kết quả |
| `/gv` | giáo viên | Tổng quan: Bài giao đang mở, học sinh chưa xếp lớp |
| `/gv/de`, `/gv/de/moi`, `/gv/de/[id]` | giáo viên | Đề thi: danh sách, tải lên + xem trước, sửa/xuất bản |
| `/gv/de/[id]/giao` | giáo viên | Giao bài |
| `/gv/bai-giao/[id]` | giáo viên | Bảng điểm, Bài làm, xuất Excel |
| `/gv/lop`, `/gv/lop/[id]`, `/gv/hoc-sinh` | giáo viên | Lớp và học sinh |

## 9. Vận hành

- Biến môi trường: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (chỉ server).
- Migration bằng Supabase CLI (`supabase/migrations`). Script tạo tài khoản giáo viên.
- GitHub Actions: `backup.yml` hằng ngày (pg_dump + Storage → artifact/repo riêng tư; đồng thời giữ project không bị pause).
- Trước khi ra mắt: chạy ma trận kiểm thử thiết bị thật trong `research/03-tuong-thich-trinh-duyet.md`.

## 10. Phiếu triển khai (theo thứ tự)

1. **Khởi tạo dự án**: Next.js 16 + TS + Tailwind 3.4 + ESLint + Vitest, browserslist, Be Vietnam Pro, KaTeX CSS; `PRODUCT.md`/`DESIGN.md` theo impeccable.
2. **CSDL**: migration schema + RLS + RPC + pg_cron + trigger chấm lại; test SQL cho chấm điểm.
3. **Đăng nhập**: đăng ký/đăng nhập/đăng xuất/đổi mật khẩu, middleware phiên 400 ngày, phân quyền giáo viên/học sinh, script tạo giáo viên.
4. **Bộ phân giải + công thức** (TS, chạy trong Web Worker): port từ spike, test với 3 đề mẫu; render KaTeX ở server.
5. **Giáo viên: Đề thi**: tải lên → xem trước → sửa → lưu nháp → xuất bản; file Word mẫu.
6. **Giáo viên: Lớp và Học sinh**.
7. **Giáo viên: Giao bài**.
8. **Học sinh: làm bài** (trang chủ, Bài giao, làm bài, tự lưu, đồng hồ, rời tab, nộp, kết quả).
9. **Giáo viên: Bảng điểm**, xem Bài làm, xuất Excel, chấm lại.
10. **Triển khai**: Supabase, Vercel, GitHub Actions sao lưu.
11. **Kiểm thử thiết bị thật** và sửa lỗi.
12. **MathType → ảnh** (WMF/EMF → PNG), khi có đề mẫu chứa MathType.
