'use client';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useRef, useState, useTransition } from 'react';
import { Alert, Badge, Button, Field, FieldError, Input, cx, focusFirstError } from '@/components/ui';
import { hasErrors, validateClassName, type FieldErrors } from '@/lib/validation';
import { archiveClass, createClass, renameClass, type Res } from './actions';

const thisYear = () => { const d = new Date(); const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-${y + 1}`; };

export function NewClassForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [clientErrs, setClientErrs] = useState<FieldErrors>({});
  const [dismissed, setDismissed] = useState<Partial<Record<string, Res | undefined>>>({});
  const [state, action, pending] = useActionState<Res | undefined, FormData>(async (p, f) => {
    const r = await createClass(p, f);
    if (r.ok) {
      ref.current?.reset();
      setClientErrs({});
      setDismissed({});
    }
    return r;
  }, undefined);

  type Key = 'name' | 'school_year';
  const serverFields = state && !state.ok ? state.fieldErrors : undefined;
  const errOf = (k: Key) => clientErrs[k] || (dismissed[k] === state ? undefined : serverFields?.[k]);
  const validateYear = (v: string) => (v.trim().length > 20 ? 'Năm học tối đa 20 ký tự.' : undefined);

  const onChange = (k: Key, v: string) => {
    setDismissed((d) => (d[k] === state ? d : { ...d, [k]: state }));
    if (clientErrs[k]) setClientErrs((e) => ({ ...e, [k]: k === 'name' ? validateClassName(v) : validateYear(v) }));
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const fd = new FormData(e.currentTarget);
    const errs: FieldErrors = {
      name: validateClassName(String(fd.get('name') ?? '')),
      school_year: validateYear(String(fd.get('school_year') ?? '')),
    };
    if (hasErrors(errs)) {
      e.preventDefault();
      setClientErrs(errs);
      focusFirstError(e.currentTarget, errs);
      return;
    }
    setClientErrs({});
  };

  const nameErr = errOf('name');
  const yearErr = errOf('school_year');

  return (
    <form ref={ref} action={action} onSubmit={onSubmit} noValidate className="grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-card sm:grid-cols-[1fr_10rem_auto] sm:items-start">
      <Field label="Tên lớp" htmlFor="new-class-name" error={nameErr}>
        <Input
          id="new-class-name"
          name="name"
          placeholder="Ví dụ: 11A2"
          required
          maxLength={60}
          invalid={!!nameErr}
          onChange={(e) => onChange('name', e.target.value)}
          onBlur={(e) => setClientErrs((prev) => ({ ...prev, name: validateClassName(e.target.value) }))}
        />
      </Field>
      <Field label="Năm học" htmlFor="new-class-year" error={yearErr}>
        <Input
          id="new-class-year"
          name="school_year"
          defaultValue={thisYear()}
          maxLength={20}
          invalid={!!yearErr}
          onChange={(e) => onChange('school_year', e.target.value)}
          onBlur={(e) => setClientErrs((prev) => ({ ...prev, school_year: validateYear(e.target.value) }))}
        />
      </Field>
      <Button type="submit" disabled={pending} className="min-h-11 sm:mt-[1.625rem]">Tạo lớp</Button>
      {state && (state.ok || !state.fieldErrors) && (
        <div className="sm:col-span-3">
          <Alert tone={state.ok ? 'ok' : 'pen'}>{state.ok ? state.message : state.error}</Alert>
        </div>
      )}
    </form>
  );
}

export function ClassRow({ c }: { c: { id: string; name: string; school_year: string | null; archived: boolean; students: number; assignments: number } }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(c.name);
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    const vErr = validateClassName(name);
    if (vErr) { setErr(vErr); return; }
    setErr('');
    start(async () => {
      const r = await renameClass(c.id, name);
      if (r.ok) setEditing(false);
      else setErr(r.fieldErrors?.name ?? r.error);
    });
  };

  return (
    <li className={cx('group relative flex flex-wrap items-center gap-3 px-4 py-3.5 transition-colors', !editing && 'hover:bg-sunken/70 focus-within:bg-sunken/70', c.archived && 'opacity-65')}>
      {editing ? (
        <form className="grid flex-1 gap-1.5" onSubmit={onSave} noValidate>
          <div className="flex flex-wrap gap-2">
            <Input
              value={name}
              onChange={(e) => {
                const v = e.target.value;
                setName(v);
                if (err) setErr(validateClassName(v) ?? '');
              }}
              onBlur={() => setErr(validateClassName(name) ?? '')}
              invalid={!!err}
              className="max-w-xs"
              aria-label="Tên lớp"
              autoFocus
            />
            <Button type="submit" disabled={pending}>Lưu</Button>
            <Button type="button" variant="secondary" onClick={() => { setEditing(false); setName(c.name); setErr(''); }}>Huỷ</Button>
          </div>
          <FieldError error={err} />
        </form>
      ) : (
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/gv/hoc-sinh?lop=${c.id}`} className="row-link font-semibold text-ink transition-colors group-hover:text-brand">
              {c.name}
            </Link>
            {c.archived && <Badge>Đã lưu trữ</Badge>}
          </div>
          <p className="num mt-0.5 text-sm text-muted">{c.school_year ? `${c.school_year} · ` : ''}{c.students} học sinh · {c.assignments} bài đã giao</p>
        </div>
      )}
      {!editing && (
        <div className="relative z-10 flex items-center gap-1">
          <Button variant="ghost" className="min-h-9 px-2.5 text-xs" onClick={() => setEditing(true)}>Đổi tên</Button>
          <Button variant="ghost" className="min-h-9 px-2.5 text-xs" disabled={pending} onClick={() => start(async () => { await archiveClass(c.id, !c.archived); })}>{c.archived ? 'Bỏ lưu trữ' : 'Lưu trữ'}</Button>
          <ChevronRight className="ml-0.5 h-4 w-4 shrink-0 text-muted/60 transition-transform group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden />
        </div>
      )}
    </li>
  );
}
