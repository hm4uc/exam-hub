'use client';
import { useState, useSyncExternalStore } from 'react';

const noop = () => () => {};
const isInApp = () => {
  let dismissed = false;
  try { dismissed = sessionStorage.getItem('eh:inapp-hint') === '1'; } catch { /* bỏ qua */ }
  return !dismissed && /Zalo|FBAN|FBAV|FB_IAB|Messenger/i.test(navigator.userAgent);
};

// Trình duyệt trong Zalo/Messenger: vẫn làm bài được, chỉ gợi ý mở bằng trình duyệt để ổn định hơn.
export function InAppHint() {
  const inApp = useSyncExternalStore(noop, isInApp, () => false);
  const [closed, setClosed] = useState(false);
  if (!inApp || closed) return null;
  return (
    <div className="border-b border-warn/30 bg-warn-soft px-4 py-2 text-sm text-warn">
      <div className="mx-auto flex max-w-3xl items-start gap-3">
        <p className="flex-1">Bạn đang mở trong Zalo/Messenger. Vẫn làm bài được, nhưng nên bấm <b>⋯</b> rồi chọn <b>Mở bằng trình duyệt</b> để ổn định hơn.</p>
        <button type="button" className="font-semibold underline" onClick={() => { setClosed(true); try { sessionStorage.setItem('eh:inapp-hint', '1'); } catch { /* bỏ qua */ } }}>Đóng</button>
      </div>
    </div>
  );
}
