# Design

Mode: **Operate** (công cụ để làm việc). Cấu trúc và điều khiển theo chuẩn web quen thuộc; cá tính nằm ở chất liệu và một điểm nhấn.

## Thế giới thị giác

Tờ giấy kiểm tra: nền giấy sáng hơi xanh, **mực bút bi xanh** cho mọi thao tác chính, **bút đỏ của giáo viên** cho điểm số và lỗi.

- **Điểm nhấn riêng**: lưới số câu vẽ như **phiếu tô trắc nghiệm** (`.bubble`): ô tròn, câu đã làm được tô kín mực xanh; ở màn kết quả ô tô xanh lá (đúng) / vàng (đúng một phần) / đỏ (sai).
- **Điểm số** viết như bút đỏ chấm bài (`.grade-mark`): đỏ, đậm, nghiêng nhẹ −4°.

## Token (src/app/globals.css, có chế độ tối)

| Token | Vai trò |
|---|---|
| `ground` / `surface` / `sunken` | nền trang / thẻ, bảng / vùng lõm, hàng hover |
| `ink` / `muted` / `line` | chữ chính / chữ phụ / viền |
| `brand` (mực xanh) | nút chính, liên kết, thanh trên của giáo viên, ô đã tô |
| `pen` (bút đỏ) | điểm số, lỗi, thao tác xoá |
| `ok` / `warn` | đúng, đã nộp / cảnh báo, đang làm dở |

## Chữ

Be Vietnam Pro (tự host qua `next/font`, có bộ dấu tiếng Việt) cho mọi vai trò; số liệu dùng `tabular-nums` (`.num`). Công thức: KaTeX, `\displaystyle`.

## Quy tắc

- Mỗi màn làm bài một câu; phiếu trả lời ở trên câu hỏi; vùng chạm tối thiểu 40px.
- Không dùng modal: xác nhận nộp bài, xoá… hiện tại chỗ.
- Không dùng emoji làm icon (dùng lucide-react), không gradient chữ, không thẻ lồng thẻ.
