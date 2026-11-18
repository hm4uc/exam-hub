-- Giáo viên tạo Bài giao bằng quyền authenticated: giá trị mặc định của cột code gọi gen_assignment_code(),
-- nên vai trò này cần quyền EXECUTE (migration đầu đã thu hồi mọi quyền gọi hàm).
grant execute on function public.gen_assignment_code() to authenticated;
