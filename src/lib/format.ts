const TZ = 'Asia/Ho_Chi_Minh';
export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso)) : '';
export const fmtScore = (n: number | string | null | undefined) =>
  n == null ? '' : Number(n).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtNum = (n: number | string | null | undefined) =>
  n == null ? '' : Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
export const isCode = (s: string) => /^[a-z2-9]{6}$/.test(s);
