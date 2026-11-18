import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-brand text-brand-on hover:bg-brand-strong shadow-sm',
  secondary: 'bg-surface text-ink border border-line hover:bg-sunken',
  ghost: 'text-brand hover:bg-brand-soft',
  danger: 'bg-surface text-pen border border-pen/40 hover:bg-pen-soft',
};
const BTN_BASE =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';

export function Button({ variant = 'primary', className, ...p }: ComponentProps<'button'> & { variant?: BtnVariant }) {
  return <button className={cx(BTN_BASE, BTN[variant], className)} {...p} />;
}

export function ButtonLink({ variant = 'primary', className, ...p }: ComponentProps<typeof Link> & { variant?: BtnVariant }) {
  return <Link className={cx(BTN_BASE, BTN[variant], className)} {...p} />;
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>
      {children}
      {error ? <p className="text-sm text-pen">{error}</p> : hint ? <p className="text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

export const inputClass =
  'block w-full min-h-11 rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:bg-sunken';

export function Input({ className, ...p }: ComponentProps<'input'>) {
  return <input className={cx(inputClass, className)} {...p} />;
}

export function Select({ className, ...p }: ComponentProps<'select'>) {
  return <select className={cx(inputClass, 'pr-8', className)} {...p} />;
}

export function Textarea({ className, ...p }: ComponentProps<'textarea'>) {
  return <textarea className={cx(inputClass, 'min-h-24 leading-relaxed', className)} {...p} />;
}

export function Panel({ className, ...p }: ComponentProps<'section'>) {
  return <section className={cx('rounded-xl border border-line bg-surface p-4 sm:p-5', className)} {...p} />;
}

type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'pen';
const TONE: Record<Tone, string> = {
  neutral: 'bg-sunken text-muted',
  brand: 'bg-brand-soft text-brand',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  pen: 'bg-pen-soft text-pen',
};
export function Badge({ tone = 'neutral', className, ...p }: ComponentProps<'span'> & { tone?: Tone }) {
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', TONE[tone], className)} {...p} />;
}

export function Alert({ tone = 'pen', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <div role={tone === 'pen' ? 'alert' : 'status'} className={cx('rounded-lg px-3 py-2.5 text-sm', TONE[tone], className)}>{children}</div>;
}

export function PageTitle({ title, children, back }: { title: string; children?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back && <Link href={back.href} className="-my-1 mb-1 inline-flex min-h-10 max-w-full items-center gap-1 text-sm text-muted hover:text-brand"><ArrowLeft className="h-4 w-4 shrink-0" aria-hidden /><span className="truncate">{back.label}</span></Link>}
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-5 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

/** Khối giữ chỗ khi trang đang tải. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('animate-pulse rounded-lg bg-sunken', className)} />;
}

/** Khung trang đang tải: tiêu đề + danh sách. Hiện ngay khi bấm chuyển trang. */
export function PageSkeleton({ rows = 5, aside = false }: { rows?: number; aside?: boolean }) {
  return (
    <div role="status" aria-label="Đang tải">
      <div className="mb-6 flex items-end justify-between gap-3">
        <Skeleton className="h-8 w-48 sm:w-64" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className={cx('grid items-start gap-6', aside && 'lg:grid-cols-[minmax(0,1fr)_20rem]')}>
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-line px-4 py-3.5 last:border-0">
              <div className="grid flex-1 gap-2"><Skeleton className="h-4 w-3/5" /><Skeleton className="h-3 w-2/5" /></div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
        {aside && <Skeleton className="hidden h-64 rounded-xl lg:block" />}
      </div>
    </div>
  );
}
