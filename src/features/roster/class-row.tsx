'use client';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useRef, useState, useTransition } from 'react';
import { Alert, Badge, Button, Input, cx } from '@/components/ui';
import { archiveClass, createClass, renameClass, type Res } from './actions';

const thisYear = () => { const d = new Date(); const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-${y + 1}`; };

export function NewClassForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<Res | undefined, FormData>(async (p, f) => { const r = await createClass(p, f); if (r.ok) ref.current?.reset(); return r; }, undefined);
  return (
    <form ref={ref} action={action} className="grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-card sm:grid-cols-[1fr_10rem_auto] sm:items-end">
      <label className="grid gap-1.5 text-sm font-medium">Tên lớp<Input name="name" placeholder="Ví dụ: 11A2" required maxLength={60} /></label>
      <label className="grid gap-1.5 text-sm font-medium">Năm học<Input name="school_year" defaultValue={thisYear()} maxLength={20} /></label>
      <Button type="submit" disabled={pending}>Tạo lớp</Button>
      {state && <div className="sm:col-span-3"><Alert tone={state.ok ? 'ok' : 'pen'}>{state.ok ? state.message : state.error}</Alert></div>}
    </form>
  );
}

export function ClassRow({ c }: { c: { id: string; name: string; school_year: string | null; archived: boolean; students: number; assignments: number } }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(c.name);
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  return (
    <li className={cx('group relative flex flex-wrap items-center gap-3 px-4 py-3.5 transition-colors', !editing && 'hover:bg-sunken/70 focus-within:bg-sunken/70', c.archived && 'opacity-65')}>
      {editing ? (
        <form className="flex flex-1 flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await renameClass(c.id, name); if (r.ok) setEditing(false); else setErr(r.error); }); }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" aria-label="Tên lớp" autoFocus />
          <Button type="submit" disabled={pending}>Lưu</Button>
          <Button type="button" variant="secondary" onClick={() => { setEditing(false); setName(c.name); }}>Huỷ</Button>
          {err && <span className="self-center text-sm text-pen">{err}</span>}
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
