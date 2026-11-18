'use client';
import { useMemo } from 'react';
import { renderRich } from '@/domain/exam/render';

/** Xem trước nội dung "văn bản + \( LaTeX \) + ⟦img:…⟧" ngay trên trình duyệt (màn soát đề của giáo viên). */
export function Rich({ src, imageUrl, className }: { src: string | null | undefined; imageUrl?: (ref: string) => string | null; className?: string }) {
  const { html, errors } = useMemo(() => renderRich(src, { imageUrl }), [src, imageUrl]);
  return (
    <>
      <div className={`rich ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: html }} />
      {errors.length > 0 && <p className="mt-1 text-xs text-pen">{errors.join(' · ')}</p>}
    </>
  );
}
