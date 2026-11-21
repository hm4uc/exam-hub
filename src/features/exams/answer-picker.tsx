'use client';
import { useState } from 'react';
import { FieldError, cx } from '@/components/ui';
import { normNum } from '@/domain/exam/parse';
import type { QType } from '@/domain/exam/types';

/** Chọn/sửa đáp án đúng cho một câu: A–D, 4 ý Đ/S, hoặc danh sách số chấp nhận. */
export function AnswerPicker({
  type,
  labels,
  value,
  onChange,
  idPrefix,
  error,
}: {
  type: QType;
  labels: string[];
  value: string | string[] | undefined;
  onChange: (v: string | string[]) => void;
  idPrefix: string;
  error?: string;
}) {
  const [touched, setTouched] = useState(false);

  if (type === 'mcq') {
    return (
      <div className="grid gap-1.5">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Đáp án đúng">
          {labels.map((l) => (
            <button key={l} type="button" role="radio" aria-checked={value === l} onClick={() => onChange(l)}
              className="bubble" data-state={value === l ? 'right' : 'empty'}>{l}</button>
          ))}
        </div>
        <FieldError error={error} />
      </div>
    );
  }
  if (type === 'tf') {
    const v = (typeof value === 'string' ? value : '____').padEnd(4, '_');
    return (
      <div className="grid gap-1.5">
        <div className="flex flex-wrap gap-3">
          {labels.map((l, j) => (
            <div key={l} className="inline-flex items-center gap-1.5 text-sm">
              <b>{l})</b>
              <div className={cx('inline-flex overflow-hidden rounded-lg border', error && v[j] === '_' ? 'border-pen' : 'border-line')}>
                {(['Đ', 'S'] as const).map((x) => (
                  <button key={x} type="button" aria-pressed={v[j] === x}
                    onClick={() => { const a = v.split(''); a[j] = x; onChange(a.join('')); }}
                    className={cx('min-h-9 px-2.5 text-sm font-semibold', v[j] === x ? (x === 'Đ' ? 'bg-ok text-surface' : 'bg-pen text-surface') : 'bg-surface text-muted hover:bg-sunken', x === 'S' && 'border-l border-line')}>
                    {x === 'Đ' ? 'Đúng' : 'Sai'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <FieldError error={error} />
      </div>
    );
  }
  const arr = Array.isArray(value) ? value : [];
  const list = arr.join(' | ');
  const badToken = arr.find((x) => normNum(x) === null);
  const liveErr = badToken !== undefined
    ? `“${badToken}” chưa phải số hợp lệ (ví dụ: -2,5 | 0,33).`
    : touched && arr.length === 0
      ? 'Nhập ít nhất một đáp án số (ví dụ: 0,5).'
      : undefined;
  const shownErr = error || liveErr;

  return (
    <div className="grid gap-1.5">
      <input
        id={`${idPrefix}-short`}
        defaultValue={list}
        inputMode="decimal"
        placeholder="Ví dụ: 0,33 | 0,3"
        aria-invalid={!!shownErr || undefined}
        onBlur={() => setTouched(true)}
        onChange={(e) => onChange(e.target.value.split('|').map((x) => x.trim()).filter(Boolean))}
        className="block w-full max-w-xs rounded-lg border border-line bg-surface px-3 py-2 text-base tabular-nums transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 aria-[invalid=true]:border-pen aria-[invalid=true]:bg-pen-soft/35 aria-[invalid=true]:focus:border-pen aria-[invalid=true]:focus:ring-pen/25"
        aria-label="Các đáp án chấp nhận, cách nhau bởi dấu |"
      />
      <FieldError error={shownErr} />
    </div>
  );
}
