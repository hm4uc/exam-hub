'use client';
import { UserPlus } from 'lucide-react';
import { useActionState, useRef, useState } from 'react';
import { Alert, Button, Field, Input, Select, focusFirstError } from '@/components/ui';
import { hasErrors, validateFullName, validatePassword, validateUsername, type FieldErrors } from '@/lib/validation';
import { createAccount, type Res } from './actions';

/** Thêm tài khoản (học sinh hoặc giáo viên). Để trống mật khẩu → tạo mật khẩu tạm, bắt đổi khi đăng nhập. */
export function CreateAccountForm({ classes, defaultClass, isAdmin = false, teacherCode = null }: { classes: { id: string; name: string }[]; defaultClass?: string; isAdmin?: boolean; teacherCode?: string | null }) {
  const ref = useRef<HTMLFormElement>(null);
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [clientErrs, setClientErrs] = useState<FieldErrors>({});
  const [dismissed, setDismissed] = useState<Partial<Record<string, Res | undefined>>>({});
  const [state, action, pending] = useActionState<Res | undefined, FormData>(async (p, f) => {
    const r = await createAccount(p, f);
    if (r.ok) {
      ref.current?.reset();
      setRole('student');
      setClientErrs({});
      setDismissed({});
    }
    return r;
  }, undefined);

  type Key = 'full_name' | 'username' | 'password';
  const serverFields = state && !state.ok ? state.fieldErrors : undefined;
  const errOf = (k: Key) => clientErrs[k] || (dismissed[k] === state ? undefined : serverFields?.[k]);

  const validateOne = (k: Key, v: string) => {
    if (k === 'full_name') return validateFullName(v, 1);
    if (k === 'username') return validateUsername(v);
    return validatePassword(v, false);
  };

  const onChange = (k: Key, v: string) => {
    setDismissed((d) => (d[k] === state ? d : { ...d, [k]: state }));
    if (clientErrs[k]) setClientErrs((e) => ({ ...e, [k]: validateOne(k, v) }));
  };

  const onBlur = (k: Key, v: string) => {
    setClientErrs((e) => ({ ...e, [k]: validateOne(k, v) }));
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const fd = new FormData(e.currentTarget);
    const errs: FieldErrors = {
      full_name: validateFullName(String(fd.get('full_name') ?? ''), 1),
      username: validateUsername(String(fd.get('username') ?? '')),
      password: validatePassword(String(fd.get('password') ?? ''), false),
    };
    if (hasErrors(errs)) {
      e.preventDefault();
      setClientErrs(errs);
      focusFirstError(e.currentTarget, errs);
      return;
    }
    setClientErrs({});
  };

  const nameErr = errOf('full_name');
  const userErr = errOf('username');
  const pwErr = errOf('password');

  return (
    <details className="group mb-4 rounded-xl border border-line bg-surface" open={state?.ok === false || undefined}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 font-semibold text-brand [&::-webkit-details-marker]:hidden">
        <UserPlus className="h-4 w-4" aria-hidden />Thêm tài khoản
      </summary>
      <form ref={ref} action={action} onSubmit={onSubmit} noValidate className="grid gap-4 border-t border-line p-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Họ và tên" htmlFor="new-name" error={nameErr}>
          <Input
            id="new-name"
            name="full_name"
            required
            maxLength={80}
            autoComplete="off"
            invalid={!!nameErr}
            onChange={(e) => onChange('full_name', e.target.value)}
            onBlur={(e) => onBlur('full_name', e.target.value)}
          />
        </Field>
        <Field label="Tên đăng nhập" htmlFor="new-username" hint={role === 'student' && teacherCode ? `Học sinh đăng nhập bằng “${teacherCode}.tên”. Chữ không dấu, số, dấu chấm, gạch dưới.` : 'Chữ không dấu, số, dấu chấm, gạch dưới.'} error={userErr}>
          <Input
            id="new-username"
            name="username"
            required
            autoCapitalize="none"
            spellCheck={false}
            autoComplete="off"
            invalid={!!userErr}
            onChange={(e) => onChange('username', e.target.value)}
            onBlur={(e) => onBlur('username', e.target.value)}
          />
        </Field>
        <Field label="Mật khẩu" htmlFor="new-password" hint="Để trống: tạo mật khẩu tạm, đăng nhập lần đầu phải đổi." error={pwErr}>
          <Input
            id="new-password"
            name="password"
            type="text"
            maxLength={72}
            autoComplete="new-password"
            invalid={!!pwErr}
            onChange={(e) => onChange('password', e.target.value)}
            onBlur={(e) => onBlur('password', e.target.value)}
          />
        </Field>
        {isAdmin ? (
          <Field label="Vai trò" htmlFor="new-role">
            <Select id="new-role" name="role" value={role} onChange={(e) => setRole(e.target.value as 'student' | 'teacher')}>
              <option value="student">Học sinh</option>
              <option value="teacher">Giáo viên</option>
            </Select>
          </Field>
        ) : <input type="hidden" name="role" value="student" />}
        {isAdmin && role === 'teacher' && (
          <Field label="Mã giáo viên" htmlFor="new-teacher-code" hint="2–12 ký tự chữ không dấu hoặc số. Học sinh của giáo viên này đăng nhập bằng “mã.tên”." error={serverFields?.teacher_code}>
            <Input id="new-teacher-code" name="teacher_code" required maxLength={12} autoCapitalize="none" spellCheck={false} autoComplete="off" invalid={!!serverFields?.teacher_code} />
          </Field>
        )}
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
        {state && (state.ok || !state.fieldErrors) && (
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
