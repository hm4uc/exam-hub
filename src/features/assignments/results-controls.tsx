'use client';
import { Check, ChevronDown, Copy, Download, ExternalLink, Link2, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useState, useSyncExternalStore, useTransition } from 'react';
import { DateTimeField } from '@/components/datetime-field';
import { Alert, Badge, Button, ButtonLink, Field, Input, Panel, Select } from '@/components/ui';
import { closeNow, createQuickAssignment, deleteAssignment, reopenNow, updateAssignment, type AsgState } from './actions';

export function CopyLink({ code, inputId = 'asg-link' }: { code: string; inputId?: string }) {
  const origin = useSyncExternalStore(() => () => {}, () => location.origin, () => '');
  const url = `${origin}/${code}`;
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { (document.getElementById(inputId) as HTMLInputElement | null)?.select(); }
  };
  return (
    <div className="flex gap-2">
      <input id={inputId} readOnly value={url} onFocus={(e) => e.target.select()} className="num min-w-0 flex-1 rounded-lg border border-line bg-sunken px-3 py-2 text-sm" aria-label="Link bài kiểm tra" />
      <Button variant="secondary" type="button" onClick={copy} aria-label="Sao chép link">
        {copied ? <Check className="h-4 w-4 text-ok" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        {copied ? 'Đã chép' : 'Chép'}
      </Button>
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
      const head = ['STT', 'Họ và tên', 'Tài khoản / Loại', 'Trạng thái', 'Điểm', 'Số lượt', 'Rời trang', 'Nộp lúc'].map((value) => ({ value, fontWeight: 'bold' as const }));
      const data = [head, ...rows.map((r) => [r.stt, r.name, r.username, r.status, r.score, r.attempts, r.leaves, r.submitted])];
      await writeXlsxFile(data, { columns: [{ width: 5 }, { width: 28 }, { width: 18 }, { width: 11 }, { width: 8 }, { width: 8 }, { width: 10 }, { width: 18 }] })
        .toFile(`${fileName.replace(/[\\/:*?"<>|]+/g, '-')}.xlsx`);
    } finally { setBusy(false); }
  };
  return <Button variant="secondary" onClick={run} disabled={busy}><Download className="h-4 w-4" aria-hidden />{busy ? 'Đang xuất…' : 'Xuất Excel'}</Button>;
}

export interface EditableAssignment {
  id: string;
  code: string;
  title: string;
  class_id: string | null;
  restrict_to_class: boolean;
  opens_at: string;
  closes_at: string | null;
  duration_minutes: number;
  max_attempts: number;
  shuffle_questions: boolean;
  shuffle_choices: boolean;
  result_mode: string;
  result_release: string;
  access_password: string;
}

export function AssignmentControls({
  a,
  classes,
  open,
  allowDelete = true,
  heading = 'Chỉnh bài giao',
  embedded = false,
}: {
  a: EditableAssignment;
  classes: { id: string; name: string }[];
  open: boolean;
  allowDelete?: boolean;
  heading?: string;
  embedded?: boolean;
}) {
  const [state, action, pending] = useActionState<AsgState, FormData>(updateAssignment.bind(null, a.id), undefined);
  const [classId, setClassId] = useState(a.class_id ?? '');
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, start] = useTransition();
  const [dirtyAt, setDirtyAt] = useState<AsgState | null>(null);
  const saved = !!state?.ok && !state.error && dirtyAt !== state;
  const pfx = `u-${a.id.slice(0, 6)}-`;

  const body = (
    <>
      {heading && <h2 className="font-semibold">{heading}</h2>}
      {state?.error && <Alert>{state.error}</Alert>}
      {saved && <Alert tone="ok">Đã lưu thay đổi.</Alert>}
      <form action={action} className="grid gap-3 sm:grid-cols-2" onChange={() => setDirtyAt(state ?? null)}>
        <div className="sm:col-span-2">
          <Field label="Tên bài" htmlFor={`${pfx}title`}><Input id={`${pfx}title`} name="title" defaultValue={a.title} required /></Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Gắn lớp (quản lý)" htmlFor={`${pfx}class`}>
            <Select id={`${pfx}class`} name="class_id" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Không gắn lớp (Link tự do)</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>
        {classId && (
          <label className="flex min-h-10 items-start gap-2.5 text-sm sm:col-span-2">
            <input type="checkbox" name="restrict_to_class" defaultChecked={a.restrict_to_class} className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--brand))]" />
            <span>
              <span className="font-medium">Chỉ cho học sinh đăng nhập đúng lớp này</span>
              <span className="block text-xs text-muted">Bỏ tick để học sinh có link vẫn làm ngay không cần đăng nhập.</span>
            </span>
          </label>
        )}
        <Field label="Thời gian (phút)" htmlFor={`${pfx}dur`}>
          <Input id={`${pfx}dur`} name="duration_minutes" type="number" min={1} max={600} defaultValue={a.duration_minutes} required inputMode="numeric" />
        </Field>
        <Field label="Số lượt làm" htmlFor={`${pfx}att`}>
          <Input id={`${pfx}att`} name="max_attempts" type="number" min={1} max={20} defaultValue={a.max_attempts} required inputMode="numeric" />
        </Field>
        <div className={embedded ? '' : 'sm:col-span-2'}>
          <DateTimeField idPrefix={pfx} name="opens_at" label="Mở lúc" initial={new Date(a.opens_at)} />
        </div>
        <div className={embedded ? '' : 'sm:col-span-2'}>
          <DateTimeField idPrefix={pfx} name="closes_at" label="Đóng lúc (không bắt buộc)" initial={a.closes_at ? new Date(a.closes_at) : null} required={false} hint="Để trống = mở đến khi bấm đóng." />
        </div>
        <div className="grid gap-1.5 text-sm sm:col-span-2">
          <label className="flex min-h-10 items-center gap-2.5"><input type="checkbox" name="shuffle_questions" defaultChecked={a.shuffle_questions} className="h-5 w-5 shrink-0 accent-[rgb(var(--brand))]" />Đảo thứ tự câu hỏi</label>
          <label className="flex min-h-10 items-center gap-2.5"><input type="checkbox" name="shuffle_choices" defaultChecked={a.shuffle_choices} className="h-5 w-5 shrink-0 accent-[rgb(var(--brand))]" />Đảo phương án A–D</label>
        </div>
        <div className={embedded ? '' : 'sm:col-span-2'}>
          <Field label="Mật khẩu (không bắt buộc)" htmlFor={`${pfx}pw`}><Input id={`${pfx}pw`} name="access_password" defaultValue={a.access_password} autoComplete="off" /></Field>
        </div>
        <div className={embedded ? '' : 'sm:col-span-2'}>
          <Field label="Học sinh được xem" htmlFor={`${pfx}mode`}>
            <Select id={`${pfx}mode`} name="result_mode" defaultValue={a.result_mode}>
              <option value="score_answers">Điểm, đáp án và lời giải</option>
              <option value="score">Chỉ điểm</option>
              <option value="none">Không xem gì</option>
            </Select>
          </Field>
        </div>
        <div className={embedded ? '' : 'sm:col-span-2'}>
          <Field label="Xem khi nào" htmlFor={`${pfx}rel`}>
            <Select id={`${pfx}rel`} name="result_release" defaultValue={a.result_release}>
              <option value="on_submit">Ngay sau khi nộp</option>
              <option value="after_close">Sau giờ đóng bài</option>
            </Select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu cấu hình'}</Button>
          {open ? (
            <Button type="button" variant="secondary" onClick={() => start(() => closeNow(a.id))} disabled={busy}>Đóng bài ngay</Button>
          ) : (
            <Button type="button" variant="secondary" onClick={() => start(() => reopenNow(a.id))} disabled={busy}>Mở lại bài</Button>
          )}
        </div>
      </form>
      {allowDelete && (
        !confirmDel ? (
          <button type="button" onClick={() => setConfirmDel(true)} className="min-h-10 justify-self-start text-sm font-medium text-pen hover:underline">Xoá bài giao…</button>
        ) : (
          <div className="grid gap-2 rounded-lg bg-pen-soft p-3 text-sm text-pen">
            Xoá bài giao và toàn bộ bài làm của học sinh? Không hoàn tác được.
            <div className="flex gap-2">
              <Button variant="danger" onClick={() => start(() => deleteAssignment(a.id))} disabled={busy}>Xoá</Button>
              <Button variant="secondary" onClick={() => setConfirmDel(false)}>Không</Button>
            </div>
          </div>
        )
      )}
    </>
  );

  if (embedded) return <div className="grid gap-3">{body}</div>;
  return <Panel className="grid gap-3">{body}</Panel>;
}

const MODE_LABEL: Record<string, string> = {
  score_answers: 'Xem điểm & đáp án',
  score: 'Chỉ xem điểm',
  none: 'Ẩn kết quả',
};

/** Hộp link làm bài nhanh ngay trên trang chi tiết Đề thi: chép gửi Zalo trong 1 bấm, sửa cấu hình tại chỗ. */
export function QuickLinkCard({
  examId,
  quick,
  className,
  attemptCount,
  open,
  classes,
}: {
  examId: string;
  quick: EditableAssignment | null;
  className: string | null;
  attemptCount: number;
  open: boolean;
  classes: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [creating, start] = useTransition();

  if (!quick) {
    return (
      <Panel className="mb-6 flex flex-wrap items-center justify-between gap-3 border-brand/30 bg-brand-soft/40">
        <div>
          <p className="font-semibold">Đề chưa có link làm bài</p>
          <p className="text-sm text-muted">Tạo ngay link mở tự do (không cần chọn lớp, học sinh bấm link làm luôn).</p>
        </div>
        <Button onClick={() => start(() => createQuickAssignment(examId))} disabled={creating}>
          <Link2 className="h-4 w-4" aria-hidden />{creating ? 'Đang tạo…' : 'Tạo link làm bài ngay'}
        </Button>
      </Panel>
    );
  }

  return (
    <section className="mb-6 rounded-xl border border-brand/30 bg-surface p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">Link làm bài ngay</h2>
          {open ? <Badge tone="ok">Đang mở</Badge> : <Badge tone="neutral">Đã đóng / Chưa mở</Badge>}
          <Badge tone={className ? 'brand' : 'neutral'}>{className ? `Lớp ${className}` : 'Link tự do'}</Badge>
          {quick.restrict_to_class && className && <Badge tone="warn">Chỉ HS lớp {className}</Badge>}
        </div>
        <Link href={`/gv/bai-giao/${quick.id}`} className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-brand hover:underline">
          Xem kết quả ({attemptCount} lượt) <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      <div className="mt-3">
        <CopyLink code={quick.code} inputId={`quick-${quick.id}`} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-muted">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <span className="num">{quick.duration_minutes} phút</span>
          <span>·</span>
          <span className="num">{quick.max_attempts} lượt</span>
          <span>·</span>
          <span>{MODE_LABEL[quick.result_mode] ?? quick.result_mode}</span>
          <span>·</span>
          <span>{quick.closes_at ? 'Có giờ đóng' : 'Mở không giới hạn'}</span>
          {quick.access_password && <><span>·</span><span>Mật khẩu: <b className="num text-ink">{quick.access_password}</b></span></>}
        </div>
        <div className="flex items-center gap-2">
          <ButtonLink href={`/${quick.code}`} target="_blank" variant="ghost" className="min-h-8 px-2.5 text-xs">
            Mở thử link
          </ButtonLink>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-line bg-sunken/70 px-2.5 text-xs font-semibold text-ink hover:bg-sunken"
            aria-expanded={editing}
          >
            <Settings2 className="h-3.5 w-3.5" aria-hidden />
            Chỉnh cấu hình
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${editing ? 'rotate-180' : ''}`} aria-hidden />
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-4 border-t border-line pt-4">
          <AssignmentControls a={quick} classes={classes} open={open} allowDelete={false} heading="" embedded />
        </div>
      )}
    </section>
  );
}
