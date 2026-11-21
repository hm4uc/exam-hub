import Link from 'next/link';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-brand text-brand-on hover:bg-brand-strong shadow-sm',
  secondary: 'bg-surface text-ink border border-line hover:bg-sunken hover:border-line',
  ghost: 'text-brand hover:bg-brand-soft',
  danger: 'bg-surface text-pen border border-pen/40 hover:bg-pen-soft',
};
const BTN_BASE =
  'inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0';

export function Button({ variant = 'primary', className, ...p }: ComponentProps<'button'> & { variant?: BtnVariant }) {
  return <button className={cx(BTN_BASE, BTN[variant], className)} {...p} />;
}

export function ButtonLink({ variant = 'primary', className, ...p }: ComponentProps<typeof Link> & { variant?: BtnVariant }) {
  return <Link className={cx(BTN_BASE, BTN[variant], className)} {...p} />;
}

export function FieldError({ error, id, className }: { error?: string; id?: string; className?: string }) {
  if (!error) return null;
  return (
    <p id={id} role="alert" className={cx('field-error-in inline-flex items-start gap-1.5 text-xs font-medium text-pen', className)}>
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{error}</span>
    </p>
  );
}

/** Đưa con trỏ tới ô nhập đầu tiên đang có lỗi trong biểu mẫu. */
export function focusFirstError(form: HTMLFormElement, errs: Record<string, string | undefined>) {
  for (const [name, msg] of Object.entries(errs)) {
    if (!msg) continue;
    const el = form.querySelector<HTMLElement>(`[name="${name}"]:not([type="hidden"]), #${name}, [id$="${name}-local"]`);
    if (el && typeof el.focus === 'function') {
      el.focus();
      return;
    }
  }
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className={cx('text-sm font-medium transition-colors', error && 'text-pen')}>{label}</label>
      {children}
      {error ? (
        <FieldError error={error} />
      ) : hint ? (
        <p className="text-xs leading-relaxed text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputClass =
  'block w-full min-h-11 rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-muted/75 transition-colors hover:border-muted/50 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:bg-sunken aria-[invalid=true]:border-pen aria-[invalid=true]:bg-pen-soft/35 aria-[invalid=true]:hover:border-pen aria-[invalid=true]:focus:border-pen aria-[invalid=true]:focus:ring-pen/25';

export function Input({ className, invalid, ...p }: ComponentProps<'input'> & { invalid?: boolean }) {
  return <input aria-invalid={invalid || p['aria-invalid'] || undefined} className={cx(inputClass, className)} {...p} />;
}

export function Select({ className, invalid, ...p }: ComponentProps<'select'> & { invalid?: boolean }) {
  return <select aria-invalid={invalid || p['aria-invalid'] || undefined} className={cx(inputClass, 'cursor-pointer pr-8', className)} {...p} />;
}

export function Textarea({ className, invalid, ...p }: ComponentProps<'textarea'> & { invalid?: boolean }) {
  return <textarea aria-invalid={invalid || p['aria-invalid'] || undefined} className={cx(inputClass, 'min-h-24 leading-relaxed', className)} {...p} />;
}

export function Panel({ className, ...p }: ComponentProps<'section'>) {
  return <section className={cx('rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5', className)} {...p} />;
}

/** Dải số liệu 2–4 cột dùng chung cho các trang tổng hợp (không lồng thẻ). */
export function StatStrip({ items }: { items: { label: string; value: string; accent?: boolean }[] }) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface shadow-card sm:grid-cols-4">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={cx(
            'px-4 py-3',
            i % 2 === 1 && 'border-l border-line',
            i >= 2 && 'border-t border-line sm:border-l sm:border-t-0',
          )}
        >
          <dt className="text-xs font-medium text-muted">{item.label}</dt>
          <dd className={cx('num mt-0.5 truncate text-xl font-bold', item.accent && 'grade-mark')}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Khung danh sách chuẩn với phân cách gọn, tương tác mượt toàn hàng. */
export const interactiveRowClass =
  'group relative flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-sunken/70 focus-within:bg-sunken/70 active:bg-sunken';

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
  return <div role={tone === 'pen' ? 'alert' : 'status'} className={cx('rounded-lg px-3.5 py-2.5 text-sm leading-relaxed', TONE[tone], className)}>{children}</div>;
}

export function PageTitle({ title, children, back }: { title: string; children?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="-my-1 mb-1 inline-flex min-h-10 max-w-full items-center gap-1 text-sm text-muted transition-colors hover:text-brand">
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{back.label}</span>
          </Link>
        )}
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface/60 px-5 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">{children}</div>}
    </div>
  );
}

export { Skeleton, PageSkeleton } from '@/components/skeletons';
