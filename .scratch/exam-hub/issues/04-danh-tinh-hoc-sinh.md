# Học sinh "chỉ nhập tên" được nhận diện và gắn với Lớp thế nào, và quy tắc 15 ngày áp lên cái gì?

Type: grilling
Status: resolved
Blocked by: -

## Question

Các tình huống phải chốt: học sinh trở thành thành viên Lớp bằng cách nào (giáo viên nhập sẵn danh sách hay tự gia nhập khi gõ tên lần đầu); tên gắn với trình duyệt/thiết bị hay với bản ghi Học sinh; đổi thiết bị (máy trường sang điện thoại ở nhà); máy dùng chung ở phòng tin; hai em trùng tên; gõ tên khác để làm lại bài; giáo viên có được sửa/gộp tên bất kỳ lúc nào không.

## Answer

Chốt với giáo viên ngày 2026-11-18:

1. **Không có danh sách nhập sẵn.** Học sinh mở link, gõ tên rồi làm bài luôn. Lần đầu gõ tên trên một trình duyệt sẽ tạo một bản ghi Học sinh, và trình duyệt đó nhớ em ấy ở các lần sau.
2. **Giáo viên tự phân lớp.** Học sinh có thể ở trạng thái *chưa phân lớp*. Giáo viên xếp em vào Lớp, chuyển lớp, sửa tên và **gộp** hai bản ghi là cùng một em (ví dụ một em dùng hai thiết bị, hoặc gõ tên hai kiểu khác nhau).
   - Mặc định đề xuất, giáo viên có thể bác: em nào mới vào qua link của một Bài giao thì được xếp tạm vào Lớp của Bài giao đó, giáo viên chuyển sau.
3. **Đổi tên thoải mái**, bỏ quy tắc 15 ngày. Đổi tên chỉ đổi tên hiển thị; các Bài làm cũ vẫn gắn với bản ghi Học sinh đó.
4. **Nhiều thiết bị:** mỗi trình duyệt mới tạo một bản ghi mới, giáo viên gộp lại khi cần. Số lượt làm tính theo bản ghi Học sinh. Chấp nhận rằng một em có thể lách bằng cách đổi máy hoặc đổi tên, vì giáo viên tin học sinh. Giáo viên xem được các Bài làm và thiết bị để tự phát hiện.
5. **Trùng tên:** giáo viên tự phân biệt khi phân lớp hoặc sửa tên; hệ thống cảnh báo khi trong cùng Lớp có tên trùng.
6. **Mỗi Học sinh thuộc tối đa một Lớp.** Theo giáo viên, không có em nào học hai lớp, nên không cần xử lý trường hợp này.

Cơ chế kỹ thuật để "trình duyệt nhớ học sinh" (ví dụ Supabase Anonymous Sign-in) sẽ chốt ở phiếu Kiến trúc.

## Cập nhật 2026-11-18

Mục 1, 3, 4 ở trên **bị thay thế**: giáo viên chuyển sang đăng nhập bằng **tài khoản + mật khẩu, không có quên mật khẩu** (chi tiết ở phiếu Tài khoản học sinh). Vẫn giữ: giáo viên tự phân lớp, chuyển lớp; mỗi Học sinh thuộc tối đa một Lớp; cảnh báo trùng tên trong Lớp.
