'use client';
import { UserPlus } from 'lucide-react';
import { useActionState, useRef, useState } from 'react';
import { Alert, Button, Field, Input, Select } from '@/components/ui';
import { createAccount, type Res } from './actions';

/** Thêm tài khoản (học sinh hoặc giáo viên). Để trống mật khẩu → tạo mật khẩu tạm, bắt đổi khi đăng nhập. */
export function CreateAccountForm({ classes, defaultClass }: { classes: { id: string; name: string }[]; defaultClass?: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [state, action, pending] = useActionState<Res | undefined, FormData>(async (p, f) => {
    const r = await createAccount(p, f);
    if (r.ok) { ref.current?.reset(); setRole('student'); }
    return r;
  }, undefined);

  return (
    <details className="group mb-4 rounded-xl border border-line bg-surface" open={state?.ok === false || undefined}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 font-semibold text-brand [&::-webkit-details-marker]:hidden">
        <UserPlus className="h-4 w-4" aria-hidden />Thêm tài khoản
      </summary>
      <form ref={ref} action={action} className="grid gap-4 border-t border-line p-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Họ và tên" htmlFor="new-name"><Input id="new-name" name="full_name" required maxLength={80} autoComplete="off" /></Field>
        <Field label="Tên đăng nhập" htmlFor="new-username" hint="Chữ không dấu, số, dấu chấm, gạch dưới.">
          <Input id="new-username" name="username" required pattern="[A-Za-z0-9._]{3,30}" autoCapitalize="none" spellCheck={false} autoComplete="off" />
        </Field>
        <Field label="Mật khẩu" htmlFor="new-password" hint="Để trống: tạo mật khẩu tạm, đăng nhập lần đầu phải đổi.">
          <Input id="new-password" name="password" type="text" minLength={6} maxLength={72} autoComplete="new-password" />
        </Field>
        <Field label="Vai trò" htmlFor="new-role">
          <Select id="new-role" name="role" value={role} onChange={(e) => setRole(e.target.value as 'student' | 'teacher')}>
            <option value="student">Học sinh</option>
            <option value="teacher">Giáo viên (toàn quyền quản lý)</option>
          </Select>
        </Field>
        {role === 'student' && (
          <Field label="Lớp" htmlFor="new-class">
            <Select id="new-class" name="class_id" defaultValue={defaultClass ?? ''}>
              <option value="">Chưa xếp lớp</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        )}
        <div className="flex items-end">
          <Button type="submit" disabled={pending} className="min-h-11 w-full sm:w-auto">{pending ? 'Đang tạo…' : 'Tạo tài khoản'}</Button>
        </div>
        {state && (
          <div className="sm:col-span-2 lg:col-span-3">
            {state.ok ? (
              <Alert tone="ok">
                {state.message}
                {state.password && <> Mật khẩu tạm: <b className="num select-all text-base tracking-wider">{state.password}</b></>}
              </Alert>
            ) : <Alert>{state.error}</Alert>}
          </div>
        )}
      </form>
    </details>
  );
}
