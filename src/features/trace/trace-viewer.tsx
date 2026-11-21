'use client';
import { AlertCircle, AlertTriangle, ChevronDown, Info, RefreshCw, Search, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Alert, Badge, Button, Empty, StatStrip, cx } from '@/components/ui';
import { CATEGORY_LABEL, EVENT_LABEL, LEVEL_LABEL, describeUA, type TraceCategory, type TraceLevel, type TraceRow } from '@/lib/trace-types';
import { purgeOldTraces } from './actions';

const TZ = 'Asia/Ho_Chi_Minh';
const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(iso));

interface Filters {
  level: string;
  cat: string;
  range: string;
  q: string;
  session: string;
  attempt: string;
}

function buildHref(base: Filters, patch: Partial<Filters>) {
  const next = { ...base, ...patch };
  const p = new URLSearchParams();
  if (next.level) p.set('level', next.level);
  if (next.cat) p.set('cat', next.cat);
  if (next.range && next.range !== '24h') p.set('range', next.range);
  if (next.q.trim()) p.set('q', next.q.trim());
  if (next.session) p.set('session', next.session);
  if (next.attempt) p.set('attempt', next.attempt);
  const s = p.toString();
  return s ? `/admin?${s}` : '/admin';
}

export function TraceViewer({
  rows,
  filters,
  stats,
}: {
  rows: TraceRow[];
  filters: Filters;
  stats: { errors24h: number; warns24h: number; total24h: number; activeAttempts: number };
}) {
  const router = useRouter();
  const [q, setQ] = useState(filters.q);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [purgeMsg, setPurgeMsg] = useState('');
  const [busy, start] = useTransition();
  const [navPending, startNav] = useTransition();

  const go = (href: string) => startNav(() => router.push(href));

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    go(buildHref(filters, { q }));
  };

  const runPurge = () => start(async () => {
    const res = await purgeOldTraces(7);
    setConfirmPurge(false);
    setPurgeMsg(res.ok ? `Đã dọn ${res.deleted} sự kiện cũ hơn 7 ngày.` : res.error);
  });

  const levels: { id: string; label: string }[] = [
    { id: '', label: 'Tất cả' },
    { id: 'error', label: 'Lỗi' },
    { id: 'warn', label: 'Cảnh báo' },
    { id: 'info', label: 'Thông tin' },
  ];

  return (
    <div className="grid gap-5">
      <StatStrip
        items={[
          { label: 'Lỗi (24 giờ)', value: String(stats.errors24h), accent: stats.errors24h > 0 },
          { label: 'Cảnh báo (24 giờ)', value: String(stats.warns24h) },
          { label: 'Tổng sự kiện (24 giờ)', value: String(stats.total24h) },
          { label: 'Đang làm bài lúc này', value: String(stats.activeAttempts) },
        ]}
      />

      <section className="grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc theo mức độ">
            {levels.map((l) => (
              <Link
                key={l.id || 'all'}
                href={buildHref(filters, { level: l.id })}
                className={cx(
                  'inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-semibold transition-colors',
                  filters.level === l.id
                    ? 'border-brand bg-brand text-brand-on'
                    : 'border-line bg-surface text-muted hover:border-brand/50 hover:text-ink',
                )}
              >
                {l.label}
              </Link>
            ))}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select
              aria-label="Lọc danh mục"
              value={filters.cat}
              onChange={(e) => go(buildHref(filters, { cat: e.target.value }))}
              className="min-h-9 rounded-lg border border-line bg-surface px-2.5 text-xs font-medium text-ink focus:border-brand focus:outline-none"
            >
              <option value="">Tất cả danh mục</option>
              {(Object.keys(CATEGORY_LABEL) as TraceCategory[]).map((c) => (
                <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
              ))}
            </select>

            <select
              aria-label="Khoảng thời gian"
              value={filters.range}
              onChange={(e) => go(buildHref(filters, { range: e.target.value }))}
              className="min-h-9 rounded-lg border border-line bg-surface px-2.5 text-xs font-medium text-ink focus:border-brand focus:outline-none"
            >
              <option value="1h">1 giờ qua</option>
              <option value="24h">24 giờ qua</option>
              <option value="7d">7 ngày qua</option>
              <option value="30d">30 ngày qua</option>
            </select>

            <Button variant="secondary" type="button" className="min-h-9 px-3 text-xs" onClick={() => startNav(() => router.refresh())} disabled={navPending}>
              <RefreshCw className={cx('h-3.5 w-3.5', navPending && 'animate-spin')} aria-hidden />Làm mới
            </Button>
          </div>
        </div>

        <form onSubmit={submitSearch} className="flex flex-wrap gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm tên đăng nhập (vd: duy.hung), mã đề (x5jqhe), nội dung lỗi…"
              aria-label="Tìm trong nhật ký"
              className="min-h-11 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 sm:min-h-10 sm:text-sm"
            />
          </div>
          <Button type="submit" variant="secondary" className="min-h-10 px-4 text-xs">Tìm</Button>
          {!confirmPurge ? (
            <Button type="button" variant="ghost" className="min-h-10 px-3 text-xs text-muted hover:text-pen" onClick={() => setConfirmPurge(true)}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden />Dọn log &gt; 7 ngày
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 rounded-lg bg-pen-soft px-2.5 py-1 text-xs text-pen">
              <span>Xoá log cũ hơn 7 ngày?</span>
              <Button type="button" variant="danger" className="min-h-8 px-2.5 text-xs" onClick={runPurge} disabled={busy}>Xoá</Button>
              <Button type="button" variant="secondary" className="min-h-8 px-2.5 text-xs" onClick={() => setConfirmPurge(false)}>Huỷ</Button>
            </div>
          )}
        </form>

        {(filters.session || filters.attempt || filters.q || filters.level || filters.cat) && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted">Đang lọc:</span>
            {filters.session && (
              <Link href={buildHref(filters, { session: '' })} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 font-medium text-brand">
                Phiên: {filters.session} <X className="h-3 w-3" aria-hidden />
              </Link>
            )}
            {filters.attempt && (
              <Link href={buildHref(filters, { attempt: '' })} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 font-medium text-brand">
                Bài làm: {filters.attempt.slice(0, 8)}… <X className="h-3 w-3" aria-hidden />
              </Link>
            )}
            {filters.q && (
              <Link href={buildHref(filters, { q: '' })} onClick={() => setQ('')} className="inline-flex items-center gap-1 rounded-full bg-sunken px-2.5 py-1 font-medium">
                “{filters.q}” <X className="h-3 w-3" aria-hidden />
              </Link>
            )}
            <Link href="/admin" onClick={() => setQ('')} className="font-semibold text-brand hover:underline">Xoá tất cả lọc</Link>
          </div>
        )}

        {purgeMsg && <Alert tone="ok">{purgeMsg}</Alert>}
      </section>

      {!rows.length ? (
        <Empty title="Chưa có sự kiện nào khớp bộ lọc">
          Khi học sinh hoặc giáo viên thao tác, đăng nhập, rời trang thi hay gặp lỗi mạng/JS, toàn bộ dấu vết sẽ hiện ở đây theo thời gian thực.
        </Empty>
      ) : (
        <div className={cx('overflow-hidden rounded-xl border border-line bg-surface shadow-card transition-opacity', navPending && 'opacity-60')}>
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <TraceItem key={r.id} row={r} filters={filters} />
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted num">
        Hiển thị tối đa 150 sự kiện gần nhất ({rows.length} dòng). Hệ thống tự động xoá nhật ký quá 30 ngày để giữ gọn dung lượng.
      </p>
    </div>
  );
}

function LevelIcon({ level }: { level: TraceLevel }) {
  if (level === 'error') return <AlertCircle className="h-4 w-4 shrink-0 text-pen" aria-hidden />;
  if (level === 'warn') return <AlertTriangle className="h-4 w-4 shrink-0 text-warn" aria-hidden />;
  return <Info className="h-4 w-4 shrink-0 text-brand" aria-hidden />;
}

function TraceItem({ row, filters }: { row: TraceRow; filters: Filters }) {
  const actor = row.username
    ? row.username
    : row.guest_key
      ? `Khách · ${row.guest_key.slice(0, 6)}`
      : 'Khách';
  const title = EVENT_LABEL[row.event] ?? row.event;
  const tone = row.level === 'error' ? 'pen' : row.level === 'warn' ? 'warn' : 'neutral';
  const hasMeta = row.meta && Object.keys(row.meta).length > 0;

  return (
    <li className={cx(row.level === 'error' && 'bg-pen-soft/20')}>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3.5 transition-colors hover:bg-sunken/70 [&::-webkit-details-marker]:hidden">
          <div className="pt-0.5"><LevelIcon level={row.level} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-semibold">{title}</span>
              <Badge tone={tone}>{LEVEL_LABEL[row.level]}</Badge>
              <Badge>{CATEGORY_LABEL[row.category] ?? row.category}</Badge>
              {row.assignment_code && <Badge tone="brand" className="num uppercase">{row.assignment_code}</Badge>}
            </div>
            {row.message && <p className="mt-1 text-sm text-ink/90">{row.message}</p>}
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
              <span className="font-medium text-ink/80">{actor}</span>
              {row.path && <><span>·</span><code className="truncate">{row.path}</code></>}
              <span>·</span>
              <span>{describeUA(row.user_agent)}</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-right">
            <span className="num text-xs text-muted">{fmtTime(row.created_at)}</span>
            <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" aria-hidden />
          </div>
        </summary>

        <div className="grid gap-2.5 border-t border-line/70 bg-sunken/30 px-4 pb-3.5 pt-3 pl-11 text-xs">
          <div className="flex flex-wrap gap-2">
            {row.username && (
              <Link href={buildHref(filters, { q: row.username })} className="rounded-md border border-line bg-sunken/70 px-2.5 py-1 font-medium text-brand hover:bg-sunken">
                Lọc theo {row.username}
              </Link>
            )}
            {row.session_id && (
              <Link href={buildHref(filters, { session: row.session_id })} className="rounded-md border border-line bg-sunken/70 px-2.5 py-1 font-medium text-brand hover:bg-sunken">
                Xem hành trình phiên ({row.session_id})
              </Link>
            )}
            {row.attempt_id && (
              <Link href={buildHref(filters, { attempt: row.attempt_id })} className="rounded-md border border-line bg-sunken/70 px-2.5 py-1 font-medium text-brand hover:bg-sunken">
                Lọc bài làm ({row.attempt_id.slice(0, 8)}…)
              </Link>
            )}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-muted">
            <dt>Mã sự kiện</dt><dd><code className="text-ink">{row.event}</code></dd>
            {row.guest_key && <><dt>Guest key</dt><dd><code className="text-ink">{row.guest_key}</code></dd></>}
            {row.user_agent && <><dt>Thiết bị</dt><dd className="break-all text-ink/80">{row.user_agent}</dd></>}
          </dl>
          {hasMeta && (
            <pre className="overflow-x-auto rounded-lg bg-sunken p-2.5 text-[11px] leading-relaxed text-ink">
              {JSON.stringify(row.meta, null, 2)}
            </pre>
          )}
        </div>
      </details>
    </li>
  );
}
