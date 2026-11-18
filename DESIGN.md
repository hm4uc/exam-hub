# Design

Mode: **Operate** (công cụ để làm việc). Cấu trúc và điều khiển theo chuẩn web quen thuộc; cá tính nằm ở chất liệu và một điểm nhấn.

## Thế giới thị giác

Tờ giấy kiểm tra trên nền **xanh dương tối**: khung (thanh trên) màu navy, **mực xanh đậm** cho mọi thao tác chính, **bút đỏ của giáo viên** cho điểm số và lỗi.

- **Điểm nhấn riêng**: lưới số câu vẽ như **phiếu tô trắc nghiệm** (`.bubble`): ô tròn, câu đã làm được tô kín mực xanh; ở màn kết quả ô tô xanh lá (đúng) / vàng (đúng một phần) / đỏ (sai).
- **Điểm số** viết như bút đỏ chấm bài (`.grade-mark`): đỏ, đậm, nghiêng nhẹ −4°.

## Sáng / Tối

Mặc định theo máy; người dùng chọn tay Sáng / Tối / Theo máy (thanh trên trên máy tính, trong menu tài khoản trên điện thoại, góc trang đăng nhập). Lựa chọn lưu ở `localStorage`, áp vào `<html data-theme>` bằng script trong `<head>` trước khi vẽ nên không nháy màu. Chế độ tối là bảng màu riêng (navy gần đen, bề mặt sáng dần theo độ nổi, mực xanh nhạt), không đảo màu máy móc. Mọi cặp chữ/nền đạt WCAG AA (≥ 4,5:1) ở cả hai chế độ.

## Token (src/app/globals.css)

| Token | Vai trò |
|---|---|
| `ground` / `surface` / `sunken` | nền trang / thẻ, bảng / vùng lõm, hàng hover |
| `ink` / `muted` / `line` | chữ chính / chữ phụ / viền |
| `shell` / `shell-ink` / `shell-muted` | thanh trên navy và chữ trên nó |
| `brand` (mực xanh đậm) | nút chính, liên kết, ô đã tô |
| `pen` (bút đỏ) | điểm số, lỗi, thao tác xoá |
| `ok` / `warn` | đúng, đã nộp / cảnh báo, đang làm dở |

## Chữ

Be Vietnam Pro (tự host qua `next/font`, có bộ dấu tiếng Việt) cho mọi vai trò; số liệu dùng `tabular-nums` (`.num`). Công thức: KaTeX, `\displaystyle`.

## Quy tắc

- Mỗi màn làm bài một câu; phiếu trả lời ở trên câu hỏi; vùng chạm tối thiểu 40px.
- Responsive: bảng trên điện thoại thu về cột chính (tên + điểm), thông tin phụ xuống dòng dưới tên; không trang nào cuộn ngang. Kiểm bằng ảnh chụp 360 / 768 / 1280px.
- Chuyển trang: mỗi nhóm trang có `loading.tsx` (khung giữ chỗ) để bấm là thấy phản hồi ngay.
- Không dùng modal: xác nhận nộp bài, xoá… hiện tại chỗ.
- Không dùng emoji làm icon (dùng lucide-react), không gradient chữ, không thẻ lồng thẻ.
