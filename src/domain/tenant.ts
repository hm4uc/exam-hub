// Quy ước tên đăng nhập khi có nhiều giáo viên: học sinh của giáo viên có mã "gva" đăng nhập bằng "gva.an".
// Khi vào từ link bài giao, hệ thống tự thêm tiền tố nên học sinh vẫn chỉ gõ "an".

export const USERNAME_MAX = 30;
export const TEACHER_CODE_RE = /^[a-z0-9]{2,12}$/;

/** Mã bài giao 6 ký tự lấy từ đường dẫn dạng /abc234, /abc234/lam, /abc234/ket-qua. */
export function assignmentCodeFromPath(path: string): string | null {
  return path.match(/^\/([a-z2-9]{6})(?:\/|\?|$)/i)?.[1]?.toLowerCase() ?? null;
}

/** Tên đăng nhập đầy đủ của học sinh thuộc giáo viên có mã `teacherCode`. Đã có tiền tố thì giữ nguyên. */
export function withTeacherPrefix(teacherCode: string | null | undefined, username: string): string {
  const u = username.trim().toLowerCase();
  if (!teacherCode) return u;
  return u.startsWith(`${teacherCode}.`) ? u : `${teacherCode}.${u}`;
}

/** Bỏ tiền tố giáo viên để hiển thị gọn cho giáo viên/học sinh đó. */
export function withoutTeacherPrefix(teacherCode: string | null | undefined, username: string): string {
  return teacherCode && username.startsWith(`${teacherCode}.`) ? username.slice(teacherCode.length + 1) : username;
}

/** Độ dài tối đa của phần tên do người dùng gõ, sau khi trừ tiền tố. */
export function maxLocalLength(teacherCode: string | null | undefined): number {
  return teacherCode ? USERNAME_MAX - teacherCode.length - 1 : USERNAME_MAX;
}

/** Các tên thử đăng nhập theo thứ tự: có tiền tố của giáo viên (khi vào từ link bài giao) trước, tên gõ nguyên sau. */
export function loginCandidates(typed: string, linkTeacherCode: string | null | undefined): string[] {
  const u = typed.trim().toLowerCase();
  if (!linkTeacherCode || u.startsWith(`${linkTeacherCode}.`)) return [u];
  return [`${linkTeacherCode}.${u}`, u];
}
