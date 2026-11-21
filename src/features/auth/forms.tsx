'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useState } from 'react';
import { Alert, Button, ButtonLink, Field, FieldError, Input, focusFirstError } from '@/components/ui';
import {
  hasErrors,
  validateAssignmentCode,
  validateFullName,
  validatePassword,
  validatePasswordConfirm,
  validateUsername,
  type FieldErrors,
} from '@/lib/validation';
import { changePassword, register, signIn, signOut, skipPasswordChange, type FormState } from './actions';

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, undefined);
  const [clientErrs, setClientErrs] = useState<FieldErrors>({});
  const [dismissed, setDismissed] = useState<Partial<Record<string, FormState>>>({});

  const errOf = (k: 'username' | 'password') =>
    clientErrs[k] || (dismissed[k] === state ? undefined : state?.fieldErrors?.[k]);

  const validateField = (k: 'username' | 'password', v: string) => {
    if (k === 'username') {
      const s = v.trim();
      if (!s) return 'Vui lòng nhập tên đăng nhập.';
      if (/\s/.test(s)) return 'Tên đăng nhập không chứa khoảng trắng.';
      return undefined;
    }
    return v ? undefined : 'Vui lòng nhập mật khẩu.';
  };

  const onChange = (k: 'username' | 'password', v: string) => {
    setDismissed((d) => (d[k] === state ? d : { ...d, [k]: state }));
    if (clientErrs[k]) setClientErrs((e) => ({ ...e, [k]: validateField(k, v) }));
  };

  const onBlur = (k: 'username' | 'password', v: string) => {
    setClientErrs((e) => ({ ...e, [k]: validateField(k, v) }));
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const fd = new FormData(e.currentTarget);
    const errs: FieldErrors = {
      username: validateField('username', String(fd.get('username') ?? '')),
      password: validateField('password', String(fd.get('password') ?? '')),
    };
    if (hasErrors(errs)) {
      e.preventDefault();
      setClientErrs(errs);
      focusFirstError(e.currentTarget, errs);
      return;
    }
    setClientErrs({});
  };

  const usernameErr = errOf('username');
  const passwordErr = errOf('password');

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      {state?.error && <Alert>{state.error}</Alert>}
      <Field label="Tên đăng nhập" htmlFor="username" error={usernameErr}>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          invalid={!!usernameErr}
          defaultValue={state?.fields?.username}
          onChange={(e) => onChange('username', e.target.value)}
          onBlur={(e) => onBlur('username', e.target.value)}
        />
      </Field>
      <Field label="Mật khẩu" htmlFor="password" error={passwordErr}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          invalid={!!passwordErr}
          onChange={(e) => onChange('password', e.target.value)}
          onBlur={(e) => onBlur('password', e.target.value)}
        />
      </Field>
      <Button type="submit" disabled={pending} className="mt-1 w-full">{pending ? 'Đang đăng nhập…' : 'Đăng nhập'}</Button>
      <p className="text-center text-sm text-muted">
        Chưa có tài khoản?{' '}
        <Link className="font-semibold text-brand underline" href={`/dang-ky${next ? `?next=${encodeURIComponent(next)}` : ''}`}>Đăng ký</Link>
      </p>
    </form>
  );
}

/** Cho học sinh có mã đề 6 ký tự vào làm ngay không cần đăng nhập. */
export function JoinByCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');

  function onChange(raw: string) {
    const v = raw.replace(/\s+/g, '').slice(0, 12);
    setCode(v);
    if (!v) {
      setErr('');
      return;
    }
    if (!/^[a-zA-Z2-9]+$/.test(v)) {
      setErr('Mã đề chỉ gồm chữ không dấu (trừ i, l, o) và số từ 2 đến 9.');
      return;
    }
    if (v.length > 6) {
      setErr('Mã đề chỉ gồm đúng 6 ký tự.');
      return;
    }
    if (err) setErr(v.length === 6 ? '' : err);
  }

  function onBlur() {
    if (!code.trim()) return;
    setErr(validateAssignmentCode(code) ?? '');
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const msg = validateAssignmentCode(code);
    if (msg) {
      setErr(msg);
      return;
    }
    setErr('');
    router.push(`/${code.trim().toLowerCase()}`);
  }

  return (
    <div className="mt-6 border-t border-line pt-5">
      <p className="text-sm font-semibold">Làm bài nhanh bằng mã đề</p>
      <p className="mt-0.5 text-xs text-muted">Không cần đăng nhập — nhập mã 6 ký tự thầy cô gửi.</p>
      <form onSubmit={onSubmit} noValidate className="mt-2.5 flex gap-2">
        <Input
          value={code}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder="Ví dụ: x5jqhe"
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          aria-label="Mã bài kiểm tra"
          invalid={!!err}
          className="num uppercase tracking-widest"
        />
        <Button type="submit" variant="secondary" className="shrink-0">Vào làm</Button>
      </form>
      <FieldError error={err} className="mt-1.5" />
    </div>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(register, undefined);
  const [clientErrs, setClientErrs] = useState<FieldErrors>({});
  const [dismissed, setDismissed] = useState<Partial<Record<string, FormState>>>({});
  const [pwVal, setPwVal] = useState('');
  const [confirmVal, setConfirmVal] = useState('');

  type Key = 'full_name' | 'username' | 'password' | 'confirm';
  const errOf = (k: Key) => clientErrs[k] || (dismissed[k] === state ? undefined : state?.fieldErrors?.[k]);

  const validateOne = (k: Key, v: string, pw = pwVal) => {
    if (k === 'full_name') return validateFullName(v, 2);
    if (k === 'username') return validateUsername(v);
    if (k === 'password') return validatePassword(v, true);
    return validatePasswordConfirm(pw, v);
  };

  const handleChange = (k: Key, v: string) => {
    setDismissed((d) => (d[k] === state ? d : { ...d, [k]: state }));
    if (k === 'password') {
      setPwVal(v);
      setClientErrs((e) => ({
        ...e,
        ...(e.password ? { password: validatePassword(v, true) } : {}),
        ...(confirmVal ? { confirm: validatePasswordConfirm(v, confirmVal) } : {}),
      }));
      return;
    }
    if (k === 'confirm') {
      setConfirmVal(v);
      setClientErrs((e) => ({ ...e, confirm: v ? validatePasswordConfirm(pwVal, v) : (e.confirm ? validatePasswordConfirm(pwVal, v) : undefined) }));
      return;
    }
    if (clientErrs[k]) setClientErrs((e) => ({ ...e, [k]: validateOne(k, v) }));
  };

  const handleBlur = (k: Key, v: string) => {
    setClientErrs((e) => ({ ...e, [k]: validateOne(k, v) }));
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const fd = new FormData(e.currentTarget);
    const fullName = String(fd.get('full_name') ?? '');
    const username = String(fd.get('username') ?? '');
    const password = String(fd.get('password') ?? '');
    const confirm = String(fd.get('confirm') ?? '');
    const errs: FieldErrors = {
      full_name: validateFullName(fullName, 2),
      username: validateUsername(username),
      password: validatePassword(password, true),
      confirm: validatePasswordConfirm(password, confirm),
    };
    if (hasErrors(errs)) {
      e.preventDefault();
      setClientErrs(errs);
      focusFirstError(e.currentTarget, errs);
      return;
    }
    setClientErrs({});
  };

  const fullNameErr = errOf('full_name');
  const usernameErr = errOf('username');
  const passwordErr = errOf('password');
  const confirmErr = errOf('confirm');

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      {state?.error && !state.fieldErrors && <Alert>{state.error}</Alert>}
      <Field label="Họ và tên" htmlFor="full_name" error={fullNameErr}>
        <Input
          id="full_name"
          name="full_name"
          autoComplete="name"
          required
          maxLength={80}
          invalid={!!fullNameErr}
          defaultValue={state?.fields?.full_name}
          onChange={(e) => handleChange('full_name', e.target.value)}
          onBlur={(e) => handleBlur('full_name', e.target.value)}
        />
      </Field>
      <Field label="Tên đăng nhập" htmlFor="username" hint="Ví dụ: an.nguyen (3–30 ký tự, không dấu)" error={usernameErr}>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          invalid={!!usernameErr}
          defaultValue={state?.fields?.username}
          onChange={(e) => handleChange('username', e.target.value)}
          onBlur={(e) => handleBlur('username', e.target.value)}
        />
      </Field>
      <Field label="Mật khẩu" htmlFor="password" hint="Ít nhất 6 ký tự." error={passwordErr}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          invalid={!!passwordErr}
          onChange={(e) => handleChange('password', e.target.value)}
          onBlur={(e) => handleBlur('password', e.target.value)}
        />
      </Field>
      <Field label="Nhập lại mật khẩu" htmlFor="confirm" error={confirmErr}>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          invalid={!!confirmErr}
          onChange={(e) => handleChange('confirm', e.target.value)}
          onBlur={(e) => handleBlur('confirm', e.target.value)}
        />
      </Field>
      <Button type="submit" disabled={pending} className="mt-1 w-full">{pending ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}</Button>
      <p className="text-center text-sm text-muted">
        Đã có tài khoản?{' '}
        <Link className="font-semibold text-brand underline" href={`/dang-nhap${next ? `?next=${encodeURIComponent(next)}` : ''}`}>Đăng nhập</Link>
      </p>
    </form>
  );
}

export function ChangePasswordForm({ next, mustChange, homeHref }: { next: string; mustChange: boolean; homeHref: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, undefined);
  const [clientErrs, setClientErrs] = useState<FieldErrors>({});
  const [dismissed, setDismissed] = useState<Partial<Record<string, FormState>>>({});
  const [pwVal, setPwVal] = useState('');
  const [confirmVal, setConfirmVal] = useState('');

  type Key = 'password' | 'confirm';
  const errOf = (k: Key) => clientErrs[k] || (dismissed[k] === state ? undefined : state?.fieldErrors?.[k]);

  const onChange = (k: Key, v: string) => {
    setDismissed((d) => (d[k] === state ? d : { ...d, [k]: state }));
    if (k === 'password') {
      setPwVal(v);
      setClientErrs((e) => ({
        ...e,
        ...(e.password ? { password: validatePassword(v, true) } : {}),
        ...(confirmVal ? { confirm: validatePasswordConfirm(v, confirmVal) } : {}),
      }));
    } else {
      setConfirmVal(v);
      setClientErrs((e) => ({ ...e, confirm: v ? validatePasswordConfirm(pwVal, v) : (e.confirm ? validatePasswordConfirm(pwVal, v) : undefined) }));
    }
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get('password') ?? '');
    const confirm = String(fd.get('confirm') ?? '');
    const errs: FieldErrors = {
      password: validatePassword(password, true),
      confirm: validatePasswordConfirm(password, confirm),
    };
    if (hasErrors(errs)) {
      e.preventDefault();
      setClientErrs(errs);
      focusFirstError(e.currentTarget, errs);
      return;
    }
    setClientErrs({});
  };

  const passwordErr = errOf('password');
  const confirmErr = errOf('confirm');

  return (
    <div className="grid gap-3">
      <form action={action} onSubmit={onSubmit} noValidate className="grid gap-4">
        <input type="hidden" name="next" value={next} />
        {state?.error && !state.fieldErrors && <Alert>{state.error}</Alert>}
        <Field label="Mật khẩu mới" htmlFor="password" hint="Ít nhất 6 ký tự." error={passwordErr}>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            invalid={!!passwordErr}
            onChange={(e) => onChange('password', e.target.value)}
            onBlur={(e) => setClientErrs((prev) => ({ ...prev, password: validatePassword(e.target.value, true) }))}
          />
        </Field>
        <Field label="Nhập lại mật khẩu mới" htmlFor="confirm" error={confirmErr}>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            invalid={!!confirmErr}
            onChange={(e) => onChange('confirm', e.target.value)}
            onBlur={(e) => setClientErrs((prev) => ({ ...prev, confirm: validatePasswordConfirm(pwVal, e.target.value) }))}
          />
        </Field>
        <Button type="submit" disabled={pending} className="w-full">{pending ? 'Đang lưu…' : 'Đổi mật khẩu'}</Button>
      </form>

      {mustChange ? (
        <form action={skipPasswordChange}>
          <input type="hidden" name="next" value={next} />
          <Button type="submit" variant="secondary" className="w-full">Để sau, giữ mật khẩu hiện tại</Button>
        </form>
      ) : (
        <ButtonLink href={next || homeHref} variant="secondary" className="w-full">Quay lại trang chủ</ButtonLink>
      )}

      <form action={signOut} className="mt-1 border-t border-line pt-3 text-center">
        <button type="submit" className="min-h-10 px-2 text-sm font-medium text-pen hover:underline">
          Đăng xuất khỏi tài khoản này
        </button>
      </form>
    </div>
  );
}
