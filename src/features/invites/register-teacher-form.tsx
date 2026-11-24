'use client';
import { useActionState } from 'react';
import { Alert, Button, Field, Input } from '@/components/ui';
import type { FormState } from '@/features/auth/actions';
import { registerTeacher } from './actions';

/** Đăng ký giáo viên bằng mã mời. Lỗi từng ô do server trả về (cùng quy tắc với form đăng ký học sinh). */
export function RegisterTeacherForm({ invite = '' }: { invite?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(registerTeacher, undefined);
  const f = state?.fields;
  const err = (k: string) => state?.fieldErrors?.[k];
  return (
    <form action={action} noValidate className="grid gap-4">
      {state?.error && !state.fieldErrors && <Alert>{state.error}</Alert>}
      <Field label="Mã mời" htmlFor="invite" error={err('invite')} hint="Do quản trị viên cấp.">
        <Input id="invite" name="invite" defaultValue={f?.invite ?? invite} required maxLength={10} autoCapitalize="none" spellCheck={false} autoComplete="off" invalid={!!err('invite')} />
      </Field>
      <Field label="Họ và tên" htmlFor="full_name" error={err('full_name')}>
        <Input id="full_name" name="full_name" defaultValue={f?.full_name} autoComplete="name" required maxLength={80} invalid={!!err('full_name')} />
      </Field>
      <Field label="Tên đăng nhập" htmlFor="username" error={err('username')} hint="Chữ không dấu, số, dấu chấm, gạch dưới.">
        <Input id="username" name="username" defaultValue={f?.username} autoCapitalize="none" spellCheck={false} autoComplete="username" required invalid={!!err('username')} />
      </Field>
      <Field label="Mật khẩu" htmlFor="password" error={err('password')}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required maxLength={72} invalid={!!err('password')} />
      </Field>
      <Field label="Nhập lại mật khẩu" htmlFor="confirm" error={err('confirm')}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required maxLength={72} invalid={!!err('confirm')} />
      </Field>
      <Button type="submit" disabled={pending} className="min-h-11 w-full">{pending ? 'Đang tạo…' : 'Tạo tài khoản giáo viên'}</Button>
    </form>
  );
}
