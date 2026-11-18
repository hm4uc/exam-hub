'use client';
import { cx } from '@/components/ui';
import type { QType } from '@/domain/exam/types';

/** Chọn/sửa đáp án đúng cho một câu: A–D, 4 ý Đ/S, hoặc danh sách số chấp nhận. */
export function AnswerPicker({ type, labels, value, onChange, idPrefix }: {
  type: QType; labels: string[]; value: string | string[] | undefined; onChange: (v: string | string[]) => void; idPrefix: string;
}) {
  if (type === 'mcq') {
    return (
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Đáp án đúng">
        {labels.map((l) => (
          <button key={l} type="button" role="radio" aria-checked={value === l} onClick={() => onChange(l)}
            className="bubble" data-state={value === l ? 'right' : 'empty'}>{l}</button>
        ))}
      </div>
    );
  }
  if (type === 'tf') {
    const v = (typeof value === 'string' ? value : '____').padEnd(4, '_');
    return (
      <div className="flex flex-wrap gap-3">
        {labels.map((l, j) => (
          <div key={l} className="inline-flex items-center gap-1.5 text-sm">
            <b>{l})</b>
            <div className="inline-flex overflow-hidden rounded-lg border border-line">
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
    );
  }
  const list = Array.isArray(value) ? value.join(' | ') : '';
  return (
    <input id={`${idPrefix}-short`} defaultValue={list} inputMode="decimal" placeholder="Ví dụ: 0,33 | 0,3"
      onChange={(e) => onChange(e.target.value.split('|').map((x) => x.trim()).filter(Boolean))}
      className="block w-full max-w-xs rounded-lg border border-line bg-surface px-3 py-2 text-base tabular-nums focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
      aria-label="Các đáp án chấp nhận, cách nhau bởi dấu |" />
  );
}
