// Hộp thư một-chỗ cho file vừa thả: lớp phủ kéo thả (mọi trang giáo viên) đặt file vào,
// màn Tải đề lấy ra. Sống trong bộ nhớ trang, qua được điều hướng phía client.
type Listener = (f: File) => void;
let pending: File | null = null;
const listeners = new Set<Listener>();

export function putDroppedFile(f: File) {
  if (listeners.size) for (const l of listeners) l(f);
  else pending = f;
}

/** Đăng ký nhận file thả; nhận ngay file đang chờ (nếu thả từ trang khác rồi chuyển sang). */
export function onDroppedFile(l: Listener) {
  listeners.add(l);
  if (pending) { const f = pending; pending = null; l(f); }
  return () => { listeners.delete(l); };
}
