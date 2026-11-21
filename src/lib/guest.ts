'use client';

export const GUEST_COOKIE = 'eh_guest';
const KEY_STORAGE = 'eh:guest_key';
const NAME_STORAGE = 'eh:guest_name';
const MAX_AGE = 400 * 24 * 60 * 60;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === 'undefined') return;
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${secure}`;
}

function generateKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Đọc guest_key hiện có (không tạo mới). */
export function getGuestKey(): string | null {
  const fromCookie = readCookie(GUEST_COOKIE);
  if (fromCookie && fromCookie.length >= 8) return fromCookie;
  try {
    const fromLs = localStorage.getItem(KEY_STORAGE);
    if (fromLs && fromLs.length >= 8) return fromLs;
  } catch { /* bỏ qua */ }
  return null;
}

/** Bảo đảm có guest_key đồng bộ ở cả cookie (cho SSR) và localStorage (dự phòng in-app browser).
 *  Trả { key, syncedFromStorage } để caller biết có vừa khôi phục cookie từ localStorage không. */
export function ensureGuestKey(): { key: string; syncedFromStorage: boolean } {
  const fromCookie = readCookie(GUEST_COOKIE);
  let fromLs: string | null = null;
  try { fromLs = localStorage.getItem(KEY_STORAGE); } catch { /* bỏ qua */ }

  if (fromCookie && fromCookie.length >= 8) {
    if (fromLs !== fromCookie) {
      try { localStorage.setItem(KEY_STORAGE, fromCookie); } catch { /* bỏ qua */ }
    }
    return { key: fromCookie, syncedFromStorage: false };
  }

  if (fromLs && fromLs.length >= 8) {
    writeCookie(GUEST_COOKIE, fromLs);
    return { key: fromLs, syncedFromStorage: true };
  }

  const key = generateKey();
  writeCookie(GUEST_COOKIE, key);
  try { localStorage.setItem(KEY_STORAGE, key); } catch { /* bỏ qua */ }
  return { key, syncedFromStorage: false };
}

export function getSavedGuestName(): string {
  try { return localStorage.getItem(NAME_STORAGE) ?? ''; } catch { return ''; }
}

export function saveGuestName(name: string) {
  const trimmed = name.trim().slice(0, 80);
  try {
    if (trimmed) localStorage.setItem(NAME_STORAGE, trimmed);
    else localStorage.removeItem(NAME_STORAGE);
  } catch { /* bỏ qua */ }
}
