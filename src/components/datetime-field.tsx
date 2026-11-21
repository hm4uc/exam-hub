'use client';
import { useState } from 'react';
import { Field, inputClass } from '@/components/ui';

const pad = (n: number) => String(n).padStart(2, '0');
/** Date → giá trị cho <input type="datetime-local"> theo giờ máy người dùng */
export const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Ô chọn ngày giờ theo giờ máy; gửi lên server dạng ISO có múi giờ qua input ẩn.
 *  Hỗ trợ optional (required=false, initial=null → không đặt giờ đóng). */
export function DateTimeField({
  name,
  label,
  initial,
  hint,
  required = true,
  idPrefix = '',
}: {
  name: string;
  label: string;
  initial: Date | null;
  hint?: string;
  required?: boolean;
  idPrefix?: string;
}) {
  const [v, setV] = useState(() => (initial ? toLocalInput(initial) : ''));
  const iso = v ? new Date(v).toISOString() : '';
  const id = `${idPrefix}${name}-local`;
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="flex gap-2">
        <input
          id={id}
          type="datetime-local"
          value={v}
          onChange={(e) => setV(e.target.value)}
          className={inputClass}
          required={required}
          suppressHydrationWarning
        />
        {!required && v && (
          <button
            type="button"
            onClick={() => setV('')}
            className="shrink-0 rounded-lg border border-line bg-surface px-2.5 text-xs font-medium text-muted hover:bg-sunken hover:text-ink"
          >
            Bỏ hạn
          </button>
        )}
      </div>
      <input type="hidden" name={name} value={iso} suppressHydrationWarning />
    </Field>
  );
}
