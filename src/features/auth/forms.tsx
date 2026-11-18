'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { Alert, Button, Field, Input } from '@/components/ui';
import { changePassword, register, signIn, type FormState } from './actions';

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, undefined);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      {state?.error && <Alert>{state.error}</Alert>}
      <Field label="Tên đăng nhập" htmlFor="username">
        <Input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required defaultValue={state?.fields?.username} />
      </Field>
      <Field label="Mật khẩu" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" disabled={pending} className="mt-1 w-full">{pending ? 'Đang đăng nhập…' : 'Đăng nhập'}</Button>
      <p className="text-center text-sm text-muted">
        Chưa có tài khoản?{' '}
        <Link className="font-semibold text-brand underline" href={`/dang-ky${next ? `?next=${encodeURIComponent(next)}` : ''}`}>Đăng ký</Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(register, undefined);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      {state?.error && <Alert>{state.error}</Alert>}
      <Field label="Họ và tên" htmlFor="full_name" hint="Ghi đúng họ tên để thầy cô nhận ra bạn.">
        <Input id="full_name" name="full_name" autoComplete="name" required defaultValue={state?.fields?.full_name} />
      </Field>
      <Field label="Tên đăng nhập" htmlFor="username" hint="Chữ không dấu, số, dấu chấm hoặc gạch dưới. Ví dụ: an.nguyen">
        <Input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required pattern="[A-Za-z0-9._]{3,30}" defaultValue={state?.fields?.username} />
      </Field>
      <Field label="Mật khẩu" htmlFor="password" hint="Ít nhất 6 ký tự. Hãy ghi nhớ: hệ thống không có chức năng quên mật khẩu.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={6} required />
      </Field>
      <Field label="Nhập lại mật khẩu" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={6} required />
      </Field>
      <Button type="submit" disabled={pending} className="mt-1 w-full">{pending ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}</Button>
      <p className="text-center text-sm text-muted">
        Đã có tài khoản?{' '}
        <Link className="font-semibold text-brand underline" href={`/dang-nhap${next ? `?next=${encodeURIComponent(next)}` : ''}`}>Đăng nhập</Link>
      </p>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, undefined);
  return (
    <form action={action} className="grid gap-4">
      {state?.error && <Alert>{state.error}</Alert>}
      <Field label="Mật khẩu mới" htmlFor="password" hint="Ít nhất 6 ký tự.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={6} required />
      </Field>
      <Field label="Nhập lại mật khẩu mới" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={6} required />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">{pending ? 'Đang lưu…' : 'Đổi mật khẩu'}</Button>
    </form>
  );
}
