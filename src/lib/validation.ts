import type { ZodError } from 'zod';
import { normNum } from '@/domain/exam/parse';

export type FieldErrors = Record<string, string | undefined>;

const USERNAME_RE = /^[a-z0-9._]{3,30}$/;
const USERNAME_CHAR_RE = /^[a-zA-Z0-9._]+$/;
const CODE_RE = /^[a-z2-9]{6}$/;

/** Chuyển lỗi Zod thành bản đồ { fieldName: message } để báo đỏ đúng từng ô nhập. */
export function zodFieldErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? '_form');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function validateTitle(v: string, label = 'tên'): string | undefined {
  const s = v.trim();
  if (!s) return `Vui lòng nhập ${label}.`;
  if (s.length > 200) return 'Tối đa 200 ký tự.';
  return undefined;
}

export function validateFullName(v: string, min = 2): string | undefined {
  const s = v.trim();
  if (!s) return 'Vui lòng nhập họ và tên.';
  if (s.length < min) return `Họ và tên cần ít nhất ${min} ký tự.`;
  if (s.length > 80) return 'Họ và tên tối đa 80 ký tự.';
  return undefined;
}

export function validateUsername(v: string): string | undefined {
  const s = v.trim();
  if (!s) return 'Vui lòng nhập tên đăng nhập.';
  if (/\s/.test(s)) return 'Tên đăng nhập không được chứa khoảng trắng.';
  if (!USERNAME_CHAR_RE.test(s)) return 'Chỉ dùng chữ không dấu (a–z), số (0–9), dấu chấm (.) hoặc gạch dưới (_).';
  if (s.length < 3 || s.length > 30) return 'Tên đăng nhập phải dài từ 3 đến 30 ký tự.';
  if (!USERNAME_RE.test(s.toLowerCase())) return 'Tên đăng nhập không hợp lệ.';
  return undefined;
}

export function validatePassword(v: string, required = true): string | undefined {
  if (!v) return required ? 'Vui lòng nhập mật khẩu.' : undefined;
  if (v.length < 6) return 'Mật khẩu cần ít nhất 6 ký tự.';
  if (v.length > 72) return 'Mật khẩu tối đa 72 ký tự.';
  return undefined;
}

export function validatePasswordConfirm(password: string, confirm: string): string | undefined {
  if (!confirm) return 'Vui lòng nhập lại mật khẩu.';
  if (password !== confirm) return 'Hai lần nhập mật khẩu chưa khớp.';
  return undefined;
}

export function validateAssignmentCode(v: string): string | undefined {
  const s = v.trim().toLowerCase();
  if (!s) return 'Vui lòng nhập mã đề 6 ký tự.';
  if (s.length !== 6) return 'Mã đề gồm đúng 6 ký tự.';
  if (!CODE_RE.test(s)) return 'Mã đề chỉ gồm chữ không dấu (trừ i, l, o) và số từ 2 đến 9.';
  return undefined;
}

export function validateDuration(v: string | number): string | undefined {
  const s = String(v).trim();
  if (!s) return 'Nhập thời gian làm bài.';
  const n = Number(s);
  if (!Number.isInteger(n) || n < 1 || n > 600) return 'Thời gian phải là số nguyên từ 1 đến 600 phút.';
  return undefined;
}

export function validateMaxAttempts(v: string | number): string | undefined {
  const s = String(v).trim();
  if (!s) return 'Nhập số lượt làm.';
  const n = Number(s);
  if (!Number.isInteger(n) || n < 1 || n > 20) return 'Số lượt làm phải là số nguyên từ 1 đến 20.';
  return undefined;
}

export function validateCloseAfterOpen(opensIso: string, closesIso: string): string | undefined {
  if (!closesIso) return undefined;
  const o = new Date(opensIso).getTime();
  const c = new Date(closesIso).getTime();
  if (Number.isNaN(c)) return 'Giờ đóng không hợp lệ.';
  if (!Number.isNaN(o) && c <= o) return 'Giờ đóng phải sau giờ mở.';
  return undefined;
}

export function validateClassName(v: string): string | undefined {
  const s = v.trim();
  if (!s) return 'Vui lòng nhập tên lớp.';
  if (s.length > 60) return 'Tên lớp tối đa 60 ký tự.';
  return undefined;
}

export function validatePointValue(v: string, allowBlank = false): string | undefined {
  const s = v.trim();
  if (!s) return allowBlank ? undefined : 'Nhập số điểm.';
  const n = Number(s.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 10) return 'Điểm phải là số từ 0 đến 10.';
  return undefined;
}

export function validateShortAnswerText(v: string, required = false): string | undefined {
  const s = v.trim();
  if (!s) return required ? 'Nhập đáp án.' : undefined;
  if (normNum(s) === null) return 'Chưa đúng định dạng số (ví dụ: -2,5 hoặc 0,75).';
  return undefined;
}

export function validateShortAnswerList(items: string[] | undefined): string | undefined {
  if (!items || !items.length) return 'Nhập ít nhất một đáp án số (ví dụ: 0,5).';
  const bad = items.find((x) => normNum(x) === null);
  if (bad !== undefined) return `“${bad}” chưa phải số hợp lệ (ví dụ: -2,5 | 0,33).`;
  return undefined;
}

export function hasErrors(e: FieldErrors): boolean {
  return Object.values(e).some(Boolean);
}
