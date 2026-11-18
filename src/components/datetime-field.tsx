'use client';
import { useEffect, useState } from 'react';
import { Field, inputClass } from '@/components/ui';

const pad = (n: number) => String(n).padStart(2, '0');
/** Date → giá trị cho <input type="datetime-local"> theo giờ máy người dùng */
export const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Ô chọn ngày giờ theo giờ máy; gửi lên server dạng ISO có múi giờ qua input ẩn. */
export function DateTimeField({ name, label, initial, hint }: { name: string; label: string; initial: Date; hint?: string }) {
  // Điền sau khi mount: server (UTC) và trình duyệt (giờ VN) khác múi giờ.
  const [v, setV] = useState('');
  const t = initial.getTime();
  useEffect(() => { setV(toLocalInput(new Date(t))); }, [t]);
  const iso = v ? new Date(v).toISOString() : '';
  return (
    <Field label={label} htmlFor={`${name}-local`} hint={hint}>
      <input id={`${name}-local`} type="datetime-local" value={v} onChange={(e) => setV(e.target.value)} className={inputClass} required />
      <input type="hidden" name={name} value={iso} />
    </Field>
  );
}
