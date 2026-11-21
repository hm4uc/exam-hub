'use client';
import { KeyRound, Lock, LockOpen, Trash2 } from 'lucide-react';
import { useActionState, useState, useTransition } from 'react';
import { Alert, Button, Field, Input, Panel, Select } from '@/components/ui';
import { deleteAccount, deleteAttempt, setLocked, setPassword, updateAccount, type Res } from './actions';

export interface Account {
  id: string; role: 'admin' | 'student' | 'teacher'; full_name: string; username: string; class_id: string | null;
  is_locked: boolean; must_change_password: boolean;
}

const Note = ({ r }: { r: Res | null | undefined }) =>
  r ? <Alert tone={r.ok ? 'ok' : 'pen'}>{r.ok ? <>{r.message}{r.password && <> Mật khẩu tạm: <b className="num select-all text-base tracking-wider">{r.password}</b></>}</> : r.error}</Alert> : null;

/** Thông tin tài khoản: họ tên, tên đăng nhập, vai trò, lớp. */
export function AccountForm({ a, classes, isSelf }: { a: Account; classes: { id: string; name: string }[]; isSelf: boolean }) {
  const [role, setRole] = useState(a.role);
  const [state, action, pending] = useActionState<Res | undefined, FormData>(updateAccount.bind(null, a.id), undefined);
  return (
    <Panel>
      <h2 className="mb-4 font-semibold">Thông tin tài khoản</h2>
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        <Field label="Họ và tên" htmlFor="full_name"><Input id="full_name" name="full_name" defaultValue={a.full_name} required maxLength={80} /></Field>
        <Field label="Tên đăng nhập" htmlFor="username" hint="Đổi tên đăng nhập thì lần sau phải đăng nhập bằng tên mới.">
          <Input id="username" name="username" defaultValue={a.username} required pattern="[A-Za-z0-9._]{3,30}" autoCapitalize="none" spellCheck={false} />
        </Field>
        <Field label="Vai trò" htmlFor="role" hint={isSelf ? 'Bạn không thể tự bỏ quyền giáo viên của mình.' : 'Giáo viên có toàn quyền quản lý đề, lớp và tài khoản.'}>
          <Select id="role" name="role" value={role} onChange={(e) => setRole(e.target.value as Account['role'])} disabled={isSelf}>
            <option value="student">Học sinh</option>
            <option value="teacher">Giáo viên</option>
          </Select>
          {isSelf && <input type="hidden" name="role" value="teacher" />}
        </Field>
        {role === 'student' ? (
          <Field label="Lớp" htmlFor="class_id">
            <Select id="class_id" name="class_id" defaultValue={a.class_id ?? ''}>
              <option value="">Chưa xếp lớp</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        ) : <input type="hidden" name="class_id" value="" />}
        <div className="sm:col-span-2 grid gap-3">
          <Note r={state} />
          <Button type="submit" disabled={pending} className="min-h-11 w-full sm:w-auto sm:justify-self-start">{pending ? 'Đang lưu…' : 'Lưu thay đổi'}</Button>
        </div>
      </form>
    </Panel>
  );
}

/** Mật khẩu: đặt mật khẩu cụ thể, hoặc tạo mật khẩu tạm. */
export function PasswordPanel({ a }: { a: Account }) {
  const [pw, setPw] = useState('');
  const [must, setMust] = useState(false);
  const [res, setRes] = useState<Res | null>(null);
  const [pending, start] = useTransition();
  const run = (password: string) => start(async () => { const r = await setPassword(a.id, password, must); setRes(r); if (r.ok) setPw(''); });
  return (
    <Panel>
      <h2 className="mb-1 font-semibold">Mật khẩu</h2>
      <p className="mb-4 text-sm text-muted">{a.must_change_password ? 'Tài khoản đang chờ đổi mật khẩu ở lần đăng nhập tới.' : 'Đặt mật khẩu mới sẽ đăng xuất tài khoản khỏi mọi máy.'}</p>
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); run(pw); }}>
        <Field label="Mật khẩu mới" htmlFor="new-pw">
          <Input id="new-pw" type="text" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} maxLength={72} autoComplete="new-password" required />
        </Field>
        <label className="flex min-h-10 items-center gap-2.5 text-sm">
          <input type="checkbox" checked={must} onChange={(e) => setMust(e.target.checked)} className="h-5 w-5 shrink-0 accent-[rgb(var(--brand))]" />
          Bắt đổi mật khẩu ở lần đăng nhập tới
        </label>
        <Note r={res} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}><KeyRound className="h-4 w-4" aria-hidden />Đặt mật khẩu này</Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => run('')}>Tạo mật khẩu tạm</Button>
        </div>
      </form>
    </Panel>
  );
}

/** Khoá / mở khoá và xoá tài khoản. */
export function DangerPanel({ a, attempts }: { a: Account; attempts: number }) {
  const [res, setRes] = useState<Res | null>(null);
  const [confirm, setConfirm] = useState('');
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Panel className="border-pen/30">
      <h2 className="mb-4 font-semibold">Khoá và xoá</h2>
      <div className="grid gap-3">
        <Note r={res} />
        <Button variant="secondary" className="justify-self-start" disabled={pending} onClick={() => start(async () => setRes(await setLocked(a.id, !a.is_locked)))}>
          {a.is_locked ? <><LockOpen className="h-4 w-4" aria-hidden />Mở khoá tài khoản</> : <><Lock className="h-4 w-4" aria-hidden />Khoá tài khoản</>}
        </Button>
        {!asking ? (
          <Button variant="danger" className="justify-self-start" onClick={() => setAsking(true)}><Trash2 className="h-4 w-4" aria-hidden />Xoá tài khoản…</Button>
        ) : (
          <form className="grid gap-3 rounded-lg bg-pen-soft p-3 text-sm" onSubmit={(e) => { e.preventDefault(); start(async () => setRes(await deleteAccount(a.id))); }}>
            <p className="text-pen">Xoá vĩnh viễn tài khoản <b>{a.username}</b>{attempts ? ` và ${attempts} bài làm` : ''}. Không khôi phục được.</p>
            <Field label={`Gõ "${a.username}" để xác nhận`} htmlFor="confirm-del">
              <Input id="confirm-del" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoCapitalize="none" spellCheck={false} autoComplete="off" />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="danger" disabled={pending || confirm.trim().toLowerCase() !== a.username}>Xoá vĩnh viễn</Button>
              <Button type="button" variant="secondary" onClick={() => { setAsking(false); setConfirm(''); }}>Thôi</Button>
            </div>
          </form>
        )}
      </div>
    </Panel>
  );
}

/** Nút xoá một bài làm (cho học sinh làm lại). `back`: chuyển về trang này sau khi xoá. */
export function DeleteAttemptButton({ id, back, label = 'Xoá bài làm' }: { id: string; back?: string; label?: string }) {
  const [asking, setAsking] = useState(false);
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  if (!asking)
    return <Button variant="ghost" className="px-2.5 text-pen hover:bg-pen-soft" onClick={() => setAsking(true)}><Trash2 className="h-4 w-4" aria-hidden />{label}</Button>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-sm">
      <span>Xoá để học sinh làm lại?</span>
      <Button variant="danger" className="px-3" disabled={pending} onClick={() => start(async () => { const r = await deleteAttempt(id, back); if (r && !r.ok) setErr(r.error); })}>Xoá</Button>
      <Button variant="secondary" className="px-3" onClick={() => setAsking(false)}>Thôi</Button>
      {err && <span className="text-pen">{err}</span>}
    </span>
  );
}
