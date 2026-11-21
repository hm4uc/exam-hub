'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ensureGuestKey } from '@/lib/guest';

/** Đồng bộ guest_key từ localStorage lên cookie nếu SSR chưa nhận được cookie, rồi làm mới trang 1 lần. */
export function GuestCookieSync({ hasCookie }: { hasCookie: boolean }) {
  const router = useRouter();
  useEffect(() => {
    const { syncedFromStorage } = ensureGuestKey();
    if (!hasCookie && syncedFromStorage) router.refresh();
  }, [hasCookie, router]);
  return null;
}
