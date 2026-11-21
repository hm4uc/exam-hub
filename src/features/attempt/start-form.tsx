'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Alert, Button, Field, Input } from '@/components/ui';
import { ensureGuestKey, getSavedGuestName, saveGuestName } from '@/lib/guest';
import { RPC_MESSAGES } from '@/lib/rpc-messages';
import { traceClient } from '@/lib/trace-client';
import { supabaseBrowser } from '@/server/supabase/client';

export function StartForm({
  code,
  hasPassword,
  duration,
  isGuest,
  initialName = '',
}: {
  code: string;
  hasPassword: boolean;
  duration: number;
  isGuest: boolean;
  initialName?: string;
}) {
  const router = useRouter();
  const savedName = useSyncExternalStore(() => () => { }, () => (isGuest ? getSavedGuestName() : ''), () => '');
  const [editedName, setEditedName] = useState<string | null>(null);
  const guestName = editedName ?? (initialName || savedName);
  const [pw, setPw] = useState('');
  const [nameErr, setNameErr] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isGuest) ensureGuestKey();
  }, [isGuest]);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    let bad = false;
    if (isGuest && guestName.trim().length > 80) {
      setNameErr('Họ và tên tối đa 80 ký tự.');
      bad = true;
    } else {
      setNameErr('');
    }
    if (hasPassword && !pw.trim()) {
      setPwErr('Vui lòng nhập mật khẩu bài kiểm tra.');
      bad = true;
    } else {
      setPwErr('');
    }
    if (bad) return;

    setBusy(true);
    setErr('');
    let guestKey: string | null = null;
    if (isGuest) {
      guestKey = ensureGuestKey().key;
      saveGuestName(guestName);
    }
    traceClient({
      category: 'exam',
      event: 'attempt_start_click',
      assignment_code: code,
      meta: { is_guest: isGuest, has_name: !!guestName.trim() },
    });

    const { error } = await supabaseBrowser().rpc('start_attempt', {
      p_code: code,
      p_password: hasPassword ? pw : null,
      p_guest_key: isGuest ? guestKey : null,
      p_guest_name: isGuest ? (guestName.trim() || null) : null,
    });
    if (error) {
      traceClient({
        level: 'warn',
        category: 'exam',
        event: 'attempt_start_failed',
        assignment_code: code,
        message: error.message,
        meta: { is_guest: isGuest, code: error.code },
        urgent: true,
      });
      if (error.message === 'WRONG_PASSWORD') {
        setPwErr(RPC_MESSAGES.WRONG_PASSWORD);
        setErr('');
      } else {
        setErr(RPC_MESSAGES[error.message] ?? 'Chưa bắt đầu được. Hãy thử lại.');
      }
      setBusy(false);
      return;
    }
    router.push(`/${code}/lam`);
  }

  return (
    <form onSubmit={start} noValidate className="grid gap-3.5">
      {err && <Alert>{err}</Alert>}
      {isGuest && (
        <Field
          label="Họ và tên của bạn (không bắt buộc)"
          htmlFor="guest-name"
          hint="Bỏ trống cũng được — hệ thống sẽ tự đặt tên mặc định."
          error={nameErr}
        >
          <Input
            id="guest-name"
            value={guestName}
            onChange={(e) => {
              const v = e.target.value;
              setEditedName(v);
              setNameErr(v.trim().length > 80 ? 'Họ và tên tối đa 80 ký tự.' : '');
            }}
            invalid={!!nameErr}
            autoComplete="name"
            placeholder="Ví dụ: Nguyễn Minh Anh - 12A1"
            suppressHydrationWarning
          />
        </Field>
      )}
      {hasPassword && (
        <Field label="Mật khẩu bài kiểm tra" htmlFor="pw" hint="Thầy cô sẽ cho bạn mật khẩu." error={pwErr}>
          <Input
            id="pw"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              if (pwErr) setPwErr(e.target.value.trim() ? '' : 'Vui lòng nhập mật khẩu bài kiểm tra.');
            }}
            onBlur={() => { if (!pw.trim()) setPwErr('Vui lòng nhập mật khẩu bài kiểm tra.'); }}
            invalid={!!pwErr}
            autoComplete="off"
            required
          />
        </Field>
      )}
      <p className="text-sm text-muted">
        Khi bấm bắt đầu, đồng hồ {duration} phút sẽ chạy kể cả khi bạn thoát ra. Bài được lưu liên tục, mất mạng vẫn làm tiếp được.
      </p>
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? 'Đang mở đề…' : 'Bắt đầu làm bài'}
      </Button>
      {isGuest && (
        <p className="text-center text-xs text-muted">
          Đã có tài khoản?{' '}
          <Link href={`/dang-nhap?next=${encodeURIComponent(`/${code}`)}`} className="font-semibold text-brand underline">
            Đăng nhập
          </Link>{' '}
          để lưu vào lịch sử lớp.
        </p>
      )}
    </form>
  );
}
