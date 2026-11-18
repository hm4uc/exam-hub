'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert, Button, Field, Input } from '@/components/ui';
import { supabaseBrowser } from '@/server/supabase/client';
import { RPC_MESSAGES } from '@/lib/rpc-messages';

export function StartForm({ code, hasPassword, duration }: { code: string; hasPassword: boolean; duration: number }) {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await supabaseBrowser().rpc('start_attempt', { p_code: code, p_password: hasPassword ? pw : null });
    if (error) { setErr(RPC_MESSAGES[error.message] ?? 'Chưa bắt đầu được. Hãy thử lại.'); setBusy(false); return; }
    router.push(`/${code}/lam`);
  }

  return (
    <form onSubmit={start} className="grid gap-3">
      {err && <Alert>{err}</Alert>}
      {hasPassword && (
        <Field label="Mật khẩu bài kiểm tra" htmlFor="pw" hint="Thầy cô sẽ cho bạn mật khẩu.">
          <Input id="pw" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="off" required />
        </Field>
      )}
      <p className="text-sm text-muted">Khi bấm bắt đầu, đồng hồ {duration} phút sẽ chạy kể cả khi bạn thoát ra. Bài được lưu liên tục, mất mạng vẫn làm tiếp được.</p>
      <Button type="submit" disabled={busy} className="w-full">{busy ? 'Đang mở đề…' : 'Bắt đầu làm bài'}</Button>
    </form>
  );
}
