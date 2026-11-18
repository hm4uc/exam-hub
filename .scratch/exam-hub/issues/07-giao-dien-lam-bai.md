# Màn hình làm bài trên điện thoại và máy tính nên trông và hoạt động thế nào?

Type: prototype
Status: resolved
Blocked by: 03

## Question

Prototype thô cho: hiển thị 3 Dạng câu có công thức và hình, điều hướng giữa các câu (danh sách số câu, đánh dấu câu chưa làm), đồng hồ đếm ngược, trạng thái tự lưu, nộp bài và màn kết quả theo chế độ xem kết quả.

## Context

- Prototype (chờ giáo viên đánh giá): https://claude.ai/artifact/Xe44S6ryVgGoJt3Au9pW8f, mã nguồn ở `prototypes/parser-spike/`.

## Answer

Giáo viên duyệt prototype (2026-11-18), sửa một điểm:
- Mỗi màn một câu; **danh sách số câu nằm phía trên câu hỏi** (xanh = đã làm, chấm vàng = đánh dấu xem lại); nút Câu trước/Câu sau; nộp bài có màn xác nhận kèm số câu bỏ trống.
- Thanh trên dính: đồng hồ (đỏ khi còn dưới 5 phút), trạng thái "Đã lưu", tiến độ "Đã làm x/y".
- Câu Đúng/Sai: mỗi ý một cặp nút Đúng/Sai. Trả lời ngắn: ô nhập `inputmode="decimal"`.
- Màn kết quả: điểm thang 10 (2 chữ số thập phân), lưới câu đúng/sai, đáp án + lời giải theo chế độ xem kết quả, số lần rời tab ghi "tham khảo".
- Giao diện: đơn giản, đẹp, thân thiện; tham khảo repo **impeccable** khi làm bản thật.
