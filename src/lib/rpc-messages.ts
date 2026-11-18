// Dùng được cả client lẫn server.
export const RPC_MESSAGES: Record<string, string> = {
  NOT_SIGNED_IN: 'Bạn cần đăng nhập lại.',
  ACCOUNT_LOCKED: 'Tài khoản đang bị khoá. Hãy báo giáo viên.',
  NOT_STUDENT: 'Tài khoản giáo viên không làm bài được.',
  NOT_FOUND: 'Không tìm thấy bài kiểm tra. Kiểm tra lại đường link.',
  WRONG_CLASS: 'Bài này dành cho lớp khác. Nếu bạn bị xếp nhầm lớp, hãy báo giáo viên.',
  NOT_OPEN: 'Bài chưa đến giờ mở.',
  CLOSED: 'Bài đã đóng.',
  NO_ATTEMPTS_LEFT: 'Bạn đã dùng hết số lượt làm bài.',
  WRONG_PASSWORD: 'Mật khẩu bài kiểm tra không đúng.',
  EMPTY_EXAM: 'Đề chưa có câu hỏi.',
  ALREADY_SUBMITTED: 'Bài đã nộp.',
  TIME_UP: 'Đã hết giờ làm bài.',
  NOT_SUBMITTED: 'Bài chưa nộp.',
};
export const rpcMessage = (e: { message?: string } | null | undefined) =>
  (e?.message && RPC_MESSAGES[e.message]) || 'Có lỗi xảy ra. Hãy thử lại.';
