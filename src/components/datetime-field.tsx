'use client';
import { useState } from 'react';
import { Field, inputClass } from '@/components/ui';

const pad = (n: number) => String(n).padStart(2, '0');
/** Date → giá trị cho <input type="datetime-local"> theo giờ máy người dùng */
export const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Ô chọn ngày giờ theo giờ máy; gửi lên server dạng ISO có múi giờ qua input ẩn.
 *  Giá trị tính theo múi giờ của trình duyệt (server render là UTC) nên bỏ cảnh báo lệch khi hydrate. */
export function DateTimeField({ name, label, initial, hint }: { name: string; label: string; initial: Date; hint?: string }) {
  const [v, setV] = useState(() => toLocalInput(initial));
  const iso = v ? new Date(v).toISOString() : '';
  return (
    <Field label={label} htmlFor={`${name}-local`} hint={hint}>
      <input id={`${name}-local`} type="datetime-local" value={v} onChange={(e) => setV(e.target.value)} className={inputClass} required suppressHydrationWarning />
      <input type="hidden" name={name} value={iso} suppressHydrationWarning />
    </Field>
  );
}
