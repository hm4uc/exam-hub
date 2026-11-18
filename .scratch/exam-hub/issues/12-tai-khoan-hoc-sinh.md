# Tài khoản học sinh được tạo, đăng nhập và cấp lại mật khẩu thế nào?

Type: grilling
Status: resolved
Blocked by: 04

## Question

Giáo viên yêu cầu học sinh đăng nhập bằng tài khoản + mật khẩu, không có quên mật khẩu, thiết kế DB chuẩn. Cần chốt: ai tạo tài khoản (học sinh tự đăng ký hay giáo viên tạo hàng loạt); tên đăng nhập là gì (không dùng email); khi học sinh quên mật khẩu thì giáo viên cấp lại thế nào; học sinh có tự đổi mật khẩu và họ tên không; giữ đăng nhập bao lâu; học sinh tự đăng ký thì vào Lớp thế nào.

## Answer

Chốt với giáo viên ngày 2026-11-18:

1. **Học sinh tự đăng ký** bằng họ tên, tên đăng nhập và mật khẩu; giáo viên xếp lớp. Em nào đăng ký qua link của một Bài giao thì được xếp tạm vào Lớp của Bài giao đó.
2. **Tên đăng nhập** do học sinh chọn: chữ không dấu, số, `.` hoặc `_`, dài 3–30 ký tự, duy nhất, không phân biệt hoa thường. Không dùng email.
3. **Không có quên mật khẩu.** Giáo viên bấm "Đặt lại mật khẩu", hệ thống sinh mật khẩu tạm; lần đăng nhập sau học sinh bắt buộc đổi. Khi đã đăng nhập, học sinh tự đổi được mật khẩu và họ tên.
4. **Giữ đăng nhập vĩnh viễn**: phiên chỉ mất khi người dùng bấm Đăng xuất (hoặc giáo viên khoá tài khoản / đặt lại mật khẩu). Đăng nhập được trên nhiều thiết bị cùng lúc. Bài đang làm dở tiếp tục được ở máy khác.
   - Ghi chú kỹ thuật cho phiếu Kiến trúc: trình duyệt giới hạn tuổi cookie (Chrome tối đa 400 ngày; Safari giới hạn 7 ngày với cookie đặt bằng JS) → cookie phiên phải đặt từ server (HttpOnly) và được gia hạn mỗi lần vào trang; refresh token không đặt hạn.
5. Giáo viên có nút **khoá tài khoản**.
