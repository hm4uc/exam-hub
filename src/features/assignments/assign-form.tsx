'use client';
import { useActionState, useMemo, useState } from 'react';
import { DateTimeField } from '@/components/datetime-field';
import { Alert, Button, Field, Input, Select, focusFirstError } from '@/components/ui';
import {
  hasErrors,
  validateCloseAfterOpen,
  validateDuration,
  validateMaxAttempts,
  validateTitle,
  type FieldErrors,
} from '@/lib/validation';
import { createAssignment, type AsgState } from './actions';

export function AssignForm({ examId, examTitle, classes }: { examId: string; examTitle: string; classes: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<AsgState, FormData>(createAssignment, undefined);
  const [classId, setClassId] = useState('');
  const opens = useMemo(() => {
    const o = new Date();
    o.setSeconds(0, 0);
    return o;
  }, []);
  const [opensIso, setOpensIso] = useState(() => opens.toISOString());
  const [closesIso, setClosesIso] = useState('');
  const [clientErrs, setClientErrs] = useState<FieldErrors>({});
  const [dismissed, setDismissed] = useState<Partial<Record<string, AsgState>>>({});

  type Key = 'title' | 'opens_at' | 'closes_at' | 'duration_minutes' | 'max_attempts' | 'access_password';
  const errOf = (k: Key) => clientErrs[k] || (dismissed[k] === state ? undefined : state?.fieldErrors?.[k]);

  const validateOne = (k: Key, v: string) => {
    if (k === 'title') return validateTitle(v, 'tên bài');
    if (k === 'duration_minutes') return validateDuration(v);
    if (k === 'max_attempts') return validateMaxAttempts(v);
    if (k === 'access_password') return v.trim().length > 40 ? 'Mật khẩu tối đa 40 ký tự.' : undefined;
    if (k === 'opens_at') return v ? undefined : 'Vui lòng chọn giờ mở.';
    return validateCloseAfterOpen(opensIso, v);
  };

  const onChangeField = (k: Key, v: string) => {
    setDismissed((d) => (d[k] === state ? d : { ...d, [k]: state }));
    if (clientErrs[k]) setClientErrs((e) => ({ ...e, [k]: validateOne(k, v) }));
  };

  const onBlurField = (k: Key, v: string) => {
    setClientErrs((e) => ({ ...e, [k]: validateOne(k, v) }));
  };

  const onOpensChange = (iso: string) => {
    setOpensIso(iso);
    setDismissed((d) => ({ ...d, opens_at: state, closes_at: state }));
    setClientErrs((e) => ({
      ...e,
      opens_at: iso ? undefined : 'Vui lòng chọn giờ mở.',
      closes_at: validateCloseAfterOpen(iso, closesIso),
    }));
  };

  const onClosesChange = (iso: string) => {
    setClosesIso(iso);
    setDismissed((d) => ({ ...d, closes_at: state }));
    setClientErrs((e) => ({ ...e, closes_at: validateCloseAfterOpen(opensIso, iso) }));
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const fd = new FormData(e.currentTarget);
    const o = String(fd.get('opens_at') ?? '');
    const c = String(fd.get('closes_at') ?? '');
    const errs: FieldErrors = {
      title: validateTitle(String(fd.get('title') ?? ''), 'tên bài'),
      opens_at: o ? undefined : 'Vui lòng chọn giờ mở.',
      closes_at: validateCloseAfterOpen(o, c),
      duration_minutes: validateDuration(String(fd.get('duration_minutes') ?? '')),
      max_attempts: validateMaxAttempts(String(fd.get('max_attempts') ?? '')),
      access_password: String(fd.get('access_password') ?? '').trim().length > 40 ? 'Mật khẩu tối đa 40 ký tự.' : undefined,
    };
    if (hasErrors(errs)) {
      e.preventDefault();
      setClientErrs(errs);
      focusFirstError(e.currentTarget, errs);
      return;
    }
    setClientErrs({});
  };

  const titleErr = errOf('title');
  const opensErr = errOf('opens_at');
  const closesErr = errOf('closes_at');
  const durErr = errOf('duration_minutes');
  const attErr = errOf('max_attempts');
  const pwErr = errOf('access_password');

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="grid gap-5">
      <input type="hidden" name="exam_id" value={examId} />
      {state?.error && !state.fieldErrors && <Alert>{state.error}</Alert>}
      <section className="grid gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 sm:p-5">
        <Field
          label="Gắn vào lớp (không bắt buộc)"
          htmlFor="class_id"
          hint="Không chọn lớp = link mở tự do cho mọi học sinh. Gắn lớp để tiện quản lý và đối chiếu sĩ số."
        >
          <Select id="class_id" name="class_id" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Không gắn lớp (Link tự do)</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Tên bài hiện cho học sinh" htmlFor="title" error={titleErr}>
          <Input
            id="title"
            name="title"
            defaultValue={examTitle}
            required
            maxLength={200}
            invalid={!!titleErr}
            onChange={(e) => onChangeField('title', e.target.value)}
            onBlur={(e) => onBlurField('title', e.target.value)}
          />
        </Field>
        {classId && (
          <div className="sm:col-span-2">
            <label className="flex min-h-10 items-start gap-2.5 text-sm">
              <input type="checkbox" name="restrict_to_class" className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--brand))]" />
              <span>
                <span className="font-medium">Chỉ cho học sinh đăng nhập đúng lớp này</span>
                <span className="block text-xs text-muted">Mặc định tắt: ai có link (kể cả chưa đăng nhập) cũng làm được; lớp chỉ để quản lý và đối chiếu sĩ số.</span>
              </span>
            </label>
          </div>
        )}
        <DateTimeField name="opens_at" label="Mở lúc" initial={opens} error={opensErr} onChangeIso={onOpensChange} />
        <DateTimeField
          name="closes_at"
          label="Đóng lúc (không bắt buộc)"
          initial={null}
          required={false}
          hint="Để trống = mở đến khi bạn bấm đóng thủ công."
          error={closesErr}
          onChangeIso={onClosesChange}
        />
        <Field label="Thời gian làm (phút)" htmlFor="duration_minutes" error={durErr}>
          <Input
            id="duration_minutes"
            name="duration_minutes"
            type="number"
            min={1}
            max={600}
            defaultValue={45}
            required
            inputMode="numeric"
            invalid={!!durErr}
            onChange={(e) => onChangeField('duration_minutes', e.target.value)}
            onBlur={(e) => onBlurField('duration_minutes', e.target.value)}
          />
        </Field>
        <Field label="Số lượt làm mỗi học sinh" htmlFor="max_attempts" error={attErr}>
          <Input
            id="max_attempts"
            name="max_attempts"
            type="number"
            min={1}
            max={20}
            defaultValue={1}
            required
            inputMode="numeric"
            invalid={!!attErr}
            onChange={(e) => onChangeField('max_attempts', e.target.value)}
            onBlur={(e) => onBlurField('max_attempts', e.target.value)}
          />
        </Field>
      </section>

      <section className="grid gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 sm:p-5">
        <fieldset className="grid gap-2 text-sm">
          <legend className="mb-1 font-medium">Chống chép bài</legend>
          <label className="flex min-h-10 items-center gap-2.5"><input type="checkbox" name="shuffle_questions" defaultChecked className="h-5 w-5 shrink-0 accent-[rgb(var(--brand))]" />Đảo thứ tự câu (trong từng Phần)</label>
          <label className="flex min-h-10 items-center gap-2.5"><input type="checkbox" name="shuffle_choices" defaultChecked className="h-5 w-5 shrink-0 accent-[rgb(var(--brand))]" />Đảo thứ tự phương án A–D</label>
          <p className="text-muted">Số lần học sinh rời khỏi trang làm bài luôn được ghi lại.</p>
        </fieldset>
        <Field label="Mật khẩu vào bài (không bắt buộc)" htmlFor="access_password" hint="Dùng khi kiểm tra tại lớp: đọc mật khẩu lúc bắt đầu." error={pwErr}>
          <Input
            id="access_password"
            name="access_password"
            maxLength={40}
            autoComplete="off"
            invalid={!!pwErr}
            onChange={(e) => onChangeField('access_password', e.target.value)}
            onBlur={(e) => onBlurField('access_password', e.target.value)}
          />
        </Field>
        <Field label="Học sinh được xem" htmlFor="result_mode">
          <Select id="result_mode" name="result_mode" defaultValue="score_answers">
            <option value="score_answers">Điểm, đáp án và lời giải</option>
            <option value="score">Chỉ điểm</option>
            <option value="none">Không xem gì</option>
          </Select>
        </Field>
        <Field label="Xem khi nào" htmlFor="result_release">
          <Select id="result_release" name="result_release" defaultValue="on_submit">
            <option value="on_submit">Ngay sau khi nộp</option>
            <option value="after_close">Sau giờ đóng bài</option>
          </Select>
        </Field>
      </section>
      <Button type="submit" disabled={pending} className="min-h-11 w-full sm:w-auto sm:justify-self-start">
        {pending ? 'Đang tạo…' : 'Tạo link làm bài'}
      </Button>
    </form>
  );
}
