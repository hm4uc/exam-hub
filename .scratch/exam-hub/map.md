# Bản đồ: Exam Hub (wayfinder:map)

## Destination

Bản spec MVP (`.scratch/exam-hub/spec.md`) gồm chức năng, mô hình dữ liệu, kiến trúc và danh sách phiếu triển khai, đủ để bắt tay code ngay. Bản đồ dừng ở đó, không code.

## Notes

- Ngôn ngữ làm việc: tiếng Việt. Thuật ngữ theo `CONTEXT.md` (Đề thi khác Bài giao).
- Phiếu grilling: gọi skill `grilling` + `domain-modeling`. Phiếu research: subagent gọi skill `research`, kết quả lưu ở `.scratch/exam-hub/research/`. Tài liệu thư viện: dùng Context7.
- Ràng buộc cứng (chốt khi lập bản đồ, 2026-11-18):
  - Một giáo viên duy nhất (dữ liệu vẫn gắn giáo viên), môn **Toán**: đề có **MathType** và **hình học**.
  - Quy mô: dưới 100 học sinh, tối đa 10 em làm cùng lúc; kiến trúc không chặn đường scale.
  - **Chi phí 0đ**: Supabase (free) + Vercel (Hobby).
  - Đầu vào MVP: **.docx soạn theo mẫu quy ước**, phân giải bằng quy tắc (không AI); luôn có màn xem trước và sửa trước khi xuất bản.
  - 3 Dạng câu theo cấu trúc mới của Bộ (trắc nghiệm, Đúng/Sai 4 ý, trả lời ngắn); không tự luận.
  - Học sinh đăng nhập bằng **tài khoản + mật khẩu, không có quên mật khẩu**; DB thiết kế chuẩn (chi tiết ở phiếu Tài khoản học sinh).
  - Cấu hình Bài giao: thời gian làm, giờ mở/đóng, số lượt (mặc định 1), đảo câu và phương án theo từng học sinh, mật khẩu tuỳ chọn, chế độ xem kết quả (không / điểm / điểm + đáp án; khi nộp hoặc sau giờ đóng), ghi số lần rời tab (không khoá màn hình). Bảng điểm theo lớp + xuất Excel.
  - Tương thích mọi thiết bị và trình duyệt phổ biến, kể cả trình duyệt trong Zalo/Messenger; tự lưu Bài làm liên tục; giờ tính theo server.

## Decisions so far

<!-- một dòng cho mỗi phiếu đã đóng -->

- [Giới hạn gói miễn phí Supabase + Vercel ảnh hưởng gì đến hệ thống?](issues/02-gioi-han-free-tier.md): đủ dùng; .docx và tự lưu không đi qua Vercel Function, hạn nộp kiểm ở server, GitHub Action backup + giữ Supabase khỏi bị pause.
- [MathType và hình học trong .docx hiển thị lên web thế nào?](issues/01-mathtype-hinh-hoc-docx.md): phân giải trên trình duyệt giáo viên; OMML → LaTeX/KaTeX (sửa được); MathType MVP = ảnh PNG từ ảnh xem trước (không sửa được); hình shape → báo lỗi, dán lại thành ảnh. Cần thử trên đề thật.
- [Những trình duyệt nào cần hỗ trợ và chúng có bẫy gì cho trang làm bài?](issues/03-tuong-thich-trinh-duyet.md): KaTeX render sẵn ở server; Bài làm lưu ở server (localStorage chỉ đệm); đếm rời tab chỉ tham khảo; mốc iOS 15.4 / Chrome 109 / Firefox 115 (không Tailwind v4).
- [Học sinh "chỉ nhập tên" được nhận diện và gắn với Lớp thế nào?](issues/04-danh-tinh-hoc-sinh.md): giáo viên tự phân lớp; mỗi Học sinh thuộc tối đa một Lớp. Phần "chỉ nhập tên" đã bị thay bằng tài khoản + mật khẩu.
- [Học sinh vào lại từ trình duyệt mới thì nhận lại bản ghi cũ thế nào?](issues/11-vao-lai-tu-trinh-duyet-moi.md): không còn áp dụng vì đã chuyển sang tài khoản + mật khẩu.
- [Mỗi Dạng câu được chấm điểm thế nào?](issues/05-quy-tac-cham-diem.md): điểm mặc định theo Bộ, sửa được theo đề, bật sẵn quy về thang 10; trả lời ngắn so theo giá trị số, nhiều đáp án chấp nhận; 2 chữ số thập phân; sửa đáp án thì tự chấm lại.
- [Gửi 2–3 file đề thật (.docx) để thử phân giải](issues/09-gui-de-mau.md): có 1 đề mẫu, công thức viết bằng ký tự Unicode (không MathType), đáp án ở "BẢNG ĐÁP ÁN" và "Câu n: Đáp án X." trong lời giải.

## Not yet specified

- Trình sửa câu hỏi phía giáo viên sau khi phân giải: sửa công thức thế nào (phụ thuộc định dạng công thức được chọn ở phiếu MathType).
- Bảo mật đáp án: đáp án không bao giờ gửi xuống trình duyệt khi đang làm, chấm ở server. Chi tiết khi chốt kiến trúc.
- Chiến lược tự lưu và khôi phục Bài làm khi mất mạng / tắt app / đổi thiết bị giữa chừng.
- Định dạng file Excel bảng điểm (cột nào, theo Bài giao hay theo Lớp).
- Quản lý Lớp: lưu trữ lớp cũ cuối năm, chuyển học sinh giữa các lớp.

## Out of scope

- Phân giải PDF/ảnh bằng AI: giai đoạn sau, không thuộc MVP.
- Tự luận, chấm tay.
- Nhiều giáo viên, phân quyền, tổ bộ môn.
- Ngân hàng câu hỏi, ma trận đề, trộn đề từ ngân hàng.
- Giám sát bằng camera, khoá toàn màn hình, app native.
