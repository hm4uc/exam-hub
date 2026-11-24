'use client';
import { Trash2 } from 'lucide-react';
import { useActionState, useRef, useTransition } from 'react';
import { Alert, Button, Field, Input } from '@/components/ui';
import { createInvite, deleteInvite, type InviteRes } from './actions';

export function CreateInviteForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<InviteRes | undefined, FormData>(async (p, f) => {
    const r = await createInvite(p, f);
    if (r.ok) ref.current?.reset();
    return r;
  }, undefined);
  return (
    <form ref={ref} action={action} className="grid gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_auto] sm:items-end">
      <Field label="Ghi chú" htmlFor="inv-note" hint="Ví dụ: tên trường hoặc người được mời.">
        <Input id="inv-note" name="note" maxLength={120} autoComplete="off" />
      </Field>
      <Field label="Số lượt dùng" htmlFor="inv-uses">
        <Input id="inv-uses" name="max_uses" type="number" min={1} max={100} defaultValue={1} inputMode="numeric" />
      </Field>
      <Field label="Hạn (ngày)" htmlFor="inv-days" hint="0 = không hết hạn.">
        <Input id="inv-days" name="days" type="number" min={0} max={365} defaultValue={14} inputMode="numeric" />
      </Field>
      <Button type="submit" disabled={pending} className="min-h-11">{pending ? 'Đang tạo…' : 'Tạo mã mời'}</Button>
      {state && !state.ok && <div className="sm:col-span-4"><Alert>{state.error}</Alert></div>}
    </form>
  );
}

export function InviteRow({ code, link, note, uses, maxUses, expires }: { code: string; link: string; note: string | null; uses: number; maxUses: number; expires: string | null }) {
  const [pending, start] = useTransition();
  return (
    <li className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="truncate font-medium">{note || 'Không có ghi chú'}</p>
        <p className="num text-sm text-muted">Đã dùng {uses}/{maxUses} · {expires ? `hết hạn ${expires}` : 'không hết hạn'}</p>
        <input readOnly value={link} aria-label={`Link đăng ký của mã ${code}`} onFocus={(e) => e.currentTarget.select()}
          className="mt-1.5 min-h-10 w-full rounded-lg border border-line bg-sunken px-3 text-sm sm:max-w-xl" />
      </div>
      <Button type="button" variant="danger" disabled={pending} onClick={() => start(async () => { await deleteInvite(code); })} className="min-h-10 justify-self-start sm:justify-self-end">
        <Trash2 className="h-4 w-4" aria-hidden />Xoá
      </Button>
    </li>
  );
}
