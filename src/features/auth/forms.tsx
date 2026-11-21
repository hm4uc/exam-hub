'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useState } from 'react';
import { Alert, Button, ButtonLink, Field, Input } from '@/components/ui';
import { isCode } from '@/lib/format';
import { changePassword, register, signIn, signOut, skipPasswordChange, type FormState } from './actions';

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

/** Cho học sinh có mã đề 6 ký tự vào làm ngay không cần đăng nhập. */
export function JoinByCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = code.trim().toLowerCase();
    if (!isCode(cleaned)) {
      setErr('Mã đề gồm đúng 6 ký tự chữ và số (không có dấu).');
      return;
    }
    setErr('');
    router.push(`/${cleaned}`);
  }

  return (
    <div className="mt-6 border-t border-line pt-5">
      <p className="text-sm font-semibold">Làm bài nhanh bằng mã đề</p>
      <p className="mt-0.5 text-xs text-muted">Không cần đăng nhập — nhập mã 6 ký tự thầy cô gửi.</p>
      <form onSubmit={onSubmit} className="mt-2.5 flex gap-2">
        <Input
          value={code}
          onChange={(e) => { setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6)); setErr(''); }}
          placeholder="Ví dụ: x5jqhe"
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          aria-label="Mã bài kiểm tra"
          className="num uppercase tracking-widest"
        />
        <Button type="submit" variant="secondary" className="shrink-0">Vào làm</Button>
      </form>
      {err && <p className="mt-1.5 text-xs text-pen">{err}</p>}
    </div>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(register, undefined);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      {state?.error && <Alert>{state.error}</Alert>}
      <Field label="Họ và tên" htmlFor="full_name">
        <Input id="full_name" name="full_name" autoComplete="name" required defaultValue={state?.fields?.full_name} />
      </Field>
      <Field label="Tên đăng nhập" htmlFor="username" hint="Ví dụ: an.nguyen">
        <Input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required pattern="[A-Za-z0-9._]{3,30}" defaultValue={state?.fields?.username} />
      </Field>
      <Field label="Mật khẩu" htmlFor="password" hint="Ít nhất 6 ký tự.">
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

export function ChangePasswordForm({ next, mustChange, homeHref }: { next: string; mustChange: boolean; homeHref: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, undefined);
  return (
    <div className="grid gap-3">
      <form action={action} className="grid gap-4">
        <input type="hidden" name="next" value={next} />
        {state?.error && <Alert>{state.error}</Alert>}
        <Field label="Mật khẩu mới" htmlFor="password" hint="Ít nhất 6 ký tự.">
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={6} required />
        </Field>
        <Field label="Nhập lại mật khẩu mới" htmlFor="confirm">
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={6} required />
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
