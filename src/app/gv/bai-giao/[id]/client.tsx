'use client';
import { Check, Copy, Download } from 'lucide-react';
import { useActionState, useState, useSyncExternalStore, useTransition } from 'react';
import { DateTimeField } from '@/components/datetime-field';
import { Alert, Button, Field, Input, Panel, Select } from '@/components/ui';
import { closeNow, deleteAssignment, updateAssignment, type AsgState } from '../actions';

export function CopyLink({ code }: { code: string }) {
  const origin = useSyncExternalStore(() => () => {}, () => location.origin, () => '');
  const url = `${origin}/${code}`;
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { (document.getElementById('asg-link') as HTMLInputElement | null)?.select(); }
  };
  return (
    <div className="flex gap-2">
      <input id="asg-link" readOnly value={url} onFocus={(e) => e.target.select()} className="num min-w-0 flex-1 rounded-lg border border-line bg-sunken px-3 py-2 text-sm" aria-label="Link bài kiểm tra" />
      <Button variant="secondary" onClick={copy} aria-label="Sao chép link">{copied ? <Check className="h-4 w-4 text-ok" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}{copied ? 'Đã chép' : 'Chép'}</Button>
    </div>
  );
}

export interface ExportRow { stt: number; name: string; username: string; status: string; score: number | null; attempts: number; leaves: number; submitted: string }

export function ExportButton({ rows, fileName }: { rows: ExportRow[]; fileName: string }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const { default: writeXlsxFile } = await import('write-excel-file/browser');
      const head = ['STT', 'Họ và tên', 'Tên đăng nhập', 'Trạng thái', 'Điểm', 'Số lượt', 'Rời trang', 'Nộp lúc'].map((value) => ({ value, fontWeight: 'bold' as const }));
      const data = [head, ...rows.map((r) => [r.stt, r.name, r.username, r.status, r.score, r.attempts, r.leaves, r.submitted])];
      await writeXlsxFile(data, { columns: [{ width: 5 }, { width: 28 }, { width: 18 }, { width: 11 }, { width: 8 }, { width: 8 }, { width: 10 }, { width: 18 }] })
        .toFile(`${fileName.replace(/[\\/:*?"<>|]+/g, '-')}.xlsx`);
    } finally { setBusy(false); }
  };
  return <Button variant="secondary" onClick={run} disabled={busy}><Download className="h-4 w-4" aria-hidden />{busy ? 'Đang xuất…' : 'Xuất Excel'}</Button>;
}

export function AssignmentControls({ a, open }: { a: { id: string; title: string; opens_at: string; closes_at: string; result_mode: string; result_release: string; access_password: string }; open: boolean }) {
  const [state, action, pending] = useActionState<AsgState, FormData>(updateAssignment.bind(null, a.id), undefined);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, start] = useTransition();
  // "Đã lưu" hiện cho tới khi giáo viên sửa tiếp form
  const [dirtyAt, setDirtyAt] = useState<AsgState | null>(null);
  const saved = !!state && !state.error && dirtyAt !== state;

  return (
    <Panel className="grid gap-3">
      <h2 className="font-semibold">Chỉnh bài giao</h2>
      {state?.error && <Alert>{state.error}</Alert>}
      {saved && !state?.error && <Alert tone="ok">Đã lưu.</Alert>}
      <form action={action} className="grid gap-3" onChange={() => setDirtyAt(state ?? null)}>
        <Field label="Tên bài" htmlFor="u-title"><Input id="u-title" name="title" defaultValue={a.title} required /></Field>
        <DateTimeField name="opens_at" label="Mở lúc" initial={new Date(a.opens_at)} />
        <DateTimeField name="closes_at" label="Đóng lúc" initial={new Date(a.closes_at)} />
        <Field label="Mật khẩu" htmlFor="u-pw"><Input id="u-pw" name="access_password" defaultValue={a.access_password} autoComplete="off" /></Field>
        <Field label="Học sinh được xem" htmlFor="u-mode">
          <Select id="u-mode" name="result_mode" defaultValue={a.result_mode}>
            <option value="score">Chỉ điểm</option><option value="score_answers">Điểm, đáp án và lời giải</option><option value="none">Không xem gì</option>
          </Select>
        </Field>
        <Field label="Xem khi nào" htmlFor="u-rel">
          <Select id="u-rel" name="result_release" defaultValue={a.result_release}>
            <option value="on_submit">Ngay sau khi nộp</option><option value="after_close">Sau giờ đóng bài</option>
          </Select>
        </Field>
        <Button type="submit" variant="secondary" disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu thay đổi'}</Button>
      </form>
      {open && <Button variant="secondary" onClick={() => start(() => closeNow(a.id))} disabled={busy}>Đóng bài ngay</Button>}
      {!confirmDel ? (
        <button type="button" onClick={() => setConfirmDel(true)} className="justify-self-start text-sm font-medium text-pen hover:underline">Xoá bài giao…</button>
      ) : (
        <div className="grid gap-2 rounded-lg bg-pen-soft p-3 text-sm text-pen">
          Xoá bài giao và toàn bộ bài làm của học sinh? Không hoàn tác được.
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => start(() => deleteAssignment(a.id))} disabled={busy}>Xoá</Button>
            <Button variant="secondary" onClick={() => setConfirmDel(false)}>Không</Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
