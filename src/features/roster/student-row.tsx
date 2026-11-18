'use client';
import { KeyRound, Lock, LockOpen, Pencil } from 'lucide-react';
import { useState, useTransition } from 'react';
import { Badge, Button, Input, cx } from '@/components/ui';
import { renameStudent, resetPassword, setLocked, setStudentClass } from './actions';

interface S { id: string; full_name: string; username: string; class_id: string | null; is_locked: boolean; must_change_password: boolean; created: string; duplicate: boolean }

export function StudentRow({ s, classes }: { s: S; classes: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(s.full_name);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [tempPw, setTempPw] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; password?: string }>, okText?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) setNote({ ok: false, text: r.error ?? 'Có lỗi xảy ra.' });
      else { if (r.password) setTempPw(r.password); setNote(okText ? { ok: true, text: okText } : null); }
    });

  return (
    <li className={cx('grid gap-3 px-4 py-3.5 lg:grid-cols-[minmax(0,1fr)_11rem_9rem_17rem] lg:items-start lg:gap-4', s.is_locked && 'bg-sunken/60')}>
      <div className="min-w-0">
        {editing ? (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await renameStudent(s.id, name); if (r.ok) setEditing(false); return r; }); }}>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1" aria-label="Họ tên" autoFocus />
            <Button type="submit" disabled={pending}>Lưu</Button>
            <Button type="button" variant="secondary" onClick={() => { setEditing(false); setName(s.full_name); }}>Huỷ</Button>
          </form>
        ) : (
          <p className="flex items-center gap-1 font-medium">
            <span className="min-w-0 break-words">{s.full_name}</span>
            <button type="button" onClick={() => setEditing(true)} className="-my-2 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-brand" aria-label={`Sửa tên ${s.full_name}`}><Pencil className="h-4 w-4" /></button>
          </p>
        )}
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <span>{s.username}</span>
          <span className="lg:hidden">· tạo {s.created}</span>
          {s.is_locked && <Badge tone="pen">Đã khoá</Badge>}
          {s.must_change_password && <Badge tone="warn">Chờ đổi mật khẩu</Badge>}
          {s.duplicate && <Badge tone="warn">Trùng tên trong lớp</Badge>}
        </p>
        {tempPw && (
          <p className="mt-2 rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">
            Mật khẩu tạm: <b className="num select-all text-base tracking-wider">{tempPw}</b><br />
            <span className="text-xs">Đưa cho học sinh. Lần đăng nhập tới em sẽ phải đặt mật khẩu mới.</span>
          </p>
        )}
        {note && <p className={cx('mt-1 text-sm', note.ok ? 'text-ok' : 'text-pen')}>{note.text}</p>}
      </div>
      <select value={s.class_id ?? ''} disabled={pending} aria-label={`Lớp của ${s.full_name}`}
        onChange={(e) => run(() => setStudentClass(s.id, e.target.value || null))}
        className={cx('min-h-11 w-full rounded-lg border bg-surface px-2.5 text-base lg:min-h-10 lg:text-sm', s.class_id ? 'border-line' : 'border-warn text-warn')}>
        <option value="">Chưa xếp lớp</option>
        {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <p className="num hidden pt-2.5 text-sm text-muted lg:block">{s.created}</p>
      <div className="flex flex-wrap gap-1 lg:justify-end">
        {!confirmReset ? (
          <Button variant="ghost" className="px-2.5" onClick={() => setConfirmReset(true)} disabled={pending}><KeyRound className="h-4 w-4" aria-hidden />Đặt lại mật khẩu</Button>
        ) : (
          <span className="inline-flex flex-wrap items-center gap-1.5 text-sm">
            Đặt lại mật khẩu?
            <Button className="px-3" onClick={() => { setConfirmReset(false); run(() => resetPassword(s.id)); }} disabled={pending}>Đặt lại</Button>
            <Button variant="secondary" className="px-3" onClick={() => setConfirmReset(false)}>Thôi</Button>
          </span>
        )}
        <Button variant="ghost" className={cx('px-2.5', !s.is_locked && 'text-pen hover:bg-pen-soft')} disabled={pending}
          onClick={() => run(() => setLocked(s.id, !s.is_locked), s.is_locked ? 'Đã mở khoá.' : 'Đã khoá và đăng xuất mọi máy.')}>
          {s.is_locked ? <><LockOpen className="h-4 w-4" aria-hidden />Mở khoá</> : <><Lock className="h-4 w-4" aria-hidden />Khoá</>}
        </Button>
      </div>
    </li>
  );
}
