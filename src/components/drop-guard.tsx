'use client';
import { useEffect } from 'react';

/** Thả nhầm file vào trang (ngoài ô chọn file) thì trình duyệt sẽ mở file và rời trang, kể cả giữa giờ làm bài.
 *  Chặn hành vi đó ở mọi trang. */
export function DropGuard() {
  useEffect(() => {
    const block = (e: DragEvent) => {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return;
      if ((e.target as HTMLElement | null)?.closest?.('input[type=file]')) return;
      e.preventDefault();
    };
    window.addEventListener('dragover', block);
    window.addEventListener('drop', block);
    return () => { window.removeEventListener('dragover', block); window.removeEventListener('drop', block); };
  }, []);
  return null;
}
