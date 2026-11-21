'use client';
import { getGuestKey } from './guest';
import type { TraceCategory, TraceLevel } from './trace-types';

export interface ClientTraceInput {
  level?: TraceLevel;
  category: TraceCategory;
  event: string;
  message?: string;
  path?: string;
  attempt_id?: string | null;
  assignment_code?: string | null;
  meta?: Record<string, unknown>;
  urgent?: boolean;
}

interface QueuedEvent {
  level: TraceLevel;
  category: TraceCategory;
  event: string;
  message?: string;
  path: string;
  guest_key?: string | null;
  attempt_id?: string | null;
  assignment_code?: string | null;
  session_id: string;
  meta?: Record<string, unknown>;
}

const SESSION_KEY = 'eh:trace_sid';
const queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let sessionIdCache = '';

export function getTraceSessionId(): string {
  if (sessionIdCache) return sessionIdCache;
  if (typeof window === 'undefined') return 'ssr';
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) { sessionIdCache = existing; return existing; }
    const created = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
    sessionStorage.setItem(SESSION_KEY, created);
    sessionIdCache = created;
    return created;
  } catch {
    sessionIdCache = Math.random().toString(36).slice(2, 14);
    return sessionIdCache;
  }
}

export function flushTracesNow(useBeacon = false) {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (!queue.length || typeof window === 'undefined') return;
  const batch = queue.splice(0, 20);
  const body = JSON.stringify({ events: batch });
  try {
    if (useBeacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const ok = navigator.sendBeacon('/api/trace', new Blob([body], { type: 'application/json' }));
      if (ok) return;
    }
    void fetch('/api/trace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch { /* không để lỗi ghi log ảnh hưởng người dùng */ }
}

export function traceClient(input: ClientTraceInput) {
  if (typeof window === 'undefined') return;
  const path = input.path ?? `${window.location.pathname}${window.location.search}`;
  const codeMatch = path.match(/^\/([a-z2-9]{6})(?:\/|$)/i);
  const item: QueuedEvent = {
    level: input.level ?? 'info',
    category: input.category,
    event: input.event.slice(0, 80),
    message: input.message ? input.message.slice(0, 400) : undefined,
    path: path.slice(0, 300),
    guest_key: getGuestKey(),
    attempt_id: input.attempt_id ?? undefined,
    assignment_code: input.assignment_code ?? (codeMatch ? codeMatch[1].toLowerCase() : undefined),
    session_id: getTraceSessionId(),
    meta: input.meta,
  };
  queue.push(item);
  if (queue.length >= 12 || input.urgent || item.level === 'error') {
    flushTracesNow(input.urgent);
    return;
  }
  if (!flushTimer) {
    flushTimer = setTimeout(() => flushTracesNow(false), 2500);
  }
}
