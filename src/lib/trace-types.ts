export type TraceLevel = 'info' | 'warn' | 'error';
export type TraceCategory = 'auth' | 'exam' | 'nav' | 'error' | 'network' | 'admin';

export interface TraceRow {
  id: number;
  created_at: string;
  level: TraceLevel;
  category: TraceCategory;
  event: string;
  message: string | null;
  path: string | null;
  user_id: string | null;
  username: string | null;
  guest_key: string | null;
  attempt_id: string | null;
  assignment_code: string | null;
  session_id: string | null;
  meta: Record<string, unknown>;
  user_agent: string | null;
}

export const LEVEL_LABEL: Record<TraceLevel, string> = {
  error: 'Lỗi',
  warn: 'Cảnh báo',
  info: 'Thông tin',
};

export const CATEGORY_LABEL: Record<TraceCategory, string> = {
  exam: 'Làm bài',
  auth: 'Tài khoản',
  error: 'Lỗi hệ thống',
  network: 'Mạng',
  nav: 'Điều hướng',
  admin: 'Quản trị',
};

export const EVENT_LABEL: Record<string, string> = {
  // Làm bài
  attempt_start_click: 'Bấm bắt đầu làm bài',
  attempt_start_failed: 'Không mở được bài làm',
  attempt_loaded: 'Đã mở đề làm bài',
  save_answers_failed: 'Lưu đáp án thất bại',
  save_answers_recovered: 'Khôi phục lưu bài thành công',
  tab_hidden: 'Chuyển tab / ẩn màn hình',
  window_blur: 'Rời khỏi cửa sổ làm bài',
  exam_exit_pagehide: 'Rời khỏi trang làm bài',
  exam_exit_confirm: 'Học sinh bấm thoát tạm',
  attempt_submit_start: 'Bấm nộp bài',
  attempt_submit_ok: 'Nộp bài thành công',
  attempt_submit_failed: 'Nộp bài thất bại',
  attempt_auto_submit: 'Hết giờ tự động nộp bài',
  attempt_forced_result: 'Chuyển sang kết quả (hết giờ / đã nộp)',
  // Tài khoản
  auth_login_ok: 'Đăng nhập thành công',
  auth_login_failed: 'Đăng nhập thất bại',
  auth_register_ok: 'Đăng ký tài khoản mới',
  auth_register_failed: 'Đăng ký thất bại',
  auth_logout: 'Đăng xuất',
  auth_password_changed: 'Đổi mật khẩu thành công',
  auth_password_skip: 'Bỏ qua đổi mật khẩu tạm',
  admin_password_reset_revoke: 'Đặt lại mật khẩu & đăng xuất máy cũ',
  admin_account_locked: 'Khoá / mở khoá tài khoản',
  // Mạng & Lỗi
  window_error: 'Lỗi JavaScript trên trình duyệt',
  unhandled_rejection: 'Lỗi bất đồng bộ chưa xử lý',
  react_error_boundary: 'Trang gặp sự cố hiển thị',
  network_offline: 'Thiết bị mất kết nối mạng',
  network_online: 'Thiết bị có mạng trở lại',
  // Điều hướng
  page_view: 'Mở trang',
  browser_back: 'Bấm nút Back trình duyệt',
  // Quản trị / Giáo viên
  exam_created: 'Tạo đề mới + link nhanh',
  assignment_created: 'Tạo link bài giao',
  attempt_deleted: 'Xoá bài làm',
  traces_purged: 'Dọn nhật ký cũ',
};

export function describeUA(ua: string | null | undefined): string {
  if (!ua) return 'Không rõ';
  if (ua === 'node' || ua === 'server') return 'Máy chủ';
  const app = /Zalo/i.test(ua) ? 'Zalo'
    : /FBAN|FBAV|Messenger/i.test(ua) ? 'Messenger/FB'
    : /Edg\//i.test(ua) ? 'Edge'
    : /Chrome\//i.test(ua) && !/Edg\//i.test(ua) ? 'Chrome'
    : /Safari\//i.test(ua) && !/Chrome\//i.test(ua) ? 'Safari'
    : /Firefox\//i.test(ua) ? 'Firefox'
    : 'Trình duyệt';
  const os = /iPhone|iPad|iOS/i.test(ua) ? 'iOS'
    : /Android/i.test(ua) ? 'Android'
    : /Windows/i.test(ua) ? 'Windows'
    : /Mac OS X/i.test(ua) ? 'macOS'
    : /Linux/i.test(ua) ? 'Linux'
    : '';
  return os ? `${app} · ${os}` : app;
}
