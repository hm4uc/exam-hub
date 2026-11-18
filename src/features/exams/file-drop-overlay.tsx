'use client';
import { FileUp } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { putDroppedFile } from './dropped-file';

const UPLOAD = '/gv/de/moi';
const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');

/** Kéo file Word vào bất kỳ đâu trong khu giáo viên → lớp phủ toàn màn hình → thả là mở màn Tải đề với file đó.
 *  Đồng thời chặn trình duyệt tự mở file khi thả lệch (mất trang đang làm). */
export function FileDropOverlay() {
  const router = useRouter();
  const path = usePathname();
  const [show, setShow] = useState(false);
  const depth = useRef(0);
  const pathRef = useRef(path);
  useEffect(() => { pathRef.current = path; }, [path]);

  useEffect(() => {
    const enter = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); depth.current++; setShow(true); };
    const over = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; };
    const leave = (e: DragEvent) => { if (!hasFiles(e)) return; depth.current = Math.max(0, depth.current - 1); if (!depth.current) setShow(false); };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0; setShow(false);
      const f = e.dataTransfer?.files[0];
      if (!f) return;
      putDroppedFile(f);
      if (pathRef.current !== UPLOAD) router.push(UPLOAD);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [router]);

  if (!show) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-shell/80 p-6 backdrop-blur-sm" aria-hidden>
      <div className="grid w-full max-w-md place-items-center gap-3 rounded-2xl border-2 border-dashed border-shell-ink/60 px-6 py-12 text-center text-shell-ink">
        <FileUp className="h-10 w-10" />
        <p className="text-lg font-bold">Thả file Word để tải đề lên</p>
        <p className="text-sm text-shell-muted">Chỉ nhận file .docx</p>
      </div>
    </div>
  );
}
