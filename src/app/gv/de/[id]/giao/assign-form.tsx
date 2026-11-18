'use client';
import Link from 'next/link';
import { useActionState, useMemo } from 'react';
import { DateTimeField } from '@/components/datetime-field';
import { Alert, Button, Field, Input, Select } from '@/components/ui';
import { createAssignment, type AsgState } from '../../../bai-giao/actions';

export function AssignForm({ examId, examTitle, classes }: { examId: string; examTitle: string; classes: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<AsgState, FormData>(createAssignment, undefined);
  const { opens, closes } = useMemo(() => {
    const o = new Date(); o.setSeconds(0, 0);
    const c = new Date(o); c.setDate(c.getDate() + 7); c.setHours(22, 0, 0, 0);
    return { opens: o, closes: c };
  }, []);

  if (!classes.length) {
    return <Alert tone="warn">Chưa có lớp nào. <Link href="/gv/lop" className="font-semibold underline">Tạo lớp</Link> trước rồi quay lại giao bài.</Alert>;
  }

  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="exam_id" value={examId} />
      {state?.error && <Alert>{state.error}</Alert>}
      <section className="grid gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 sm:p-5">
        <Field label="Giao cho lớp" htmlFor="class_id">
          <Select id="class_id" name="class_id" required defaultValue="">
            <option value="" disabled>Chọn lớp…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Tên bài hiện cho học sinh" htmlFor="title"><Input id="title" name="title" defaultValue={examTitle} required maxLength={200} /></Field>
        <DateTimeField name="opens_at" label="Mở lúc" initial={opens} />
        <DateTimeField name="closes_at" label="Đóng lúc" initial={closes} hint="Sau giờ này không ai bắt đầu hay lưu bài được nữa." />
        <Field label="Thời gian làm (phút)" htmlFor="duration_minutes">
          <Input id="duration_minutes" name="duration_minutes" type="number" min={1} max={600} defaultValue={45} required inputMode="numeric" />
        </Field>
        <Field label="Số lượt làm mỗi học sinh" htmlFor="max_attempts">
          <Input id="max_attempts" name="max_attempts" type="number" min={1} max={20} defaultValue={1} required inputMode="numeric" />
        </Field>
      </section>

      <section className="grid gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 sm:p-5">
        <fieldset className="grid gap-2 text-sm">
          <legend className="mb-1 font-medium">Chống chép bài</legend>
          <label className="flex items-center gap-2"><input type="checkbox" name="shuffle_questions" defaultChecked className="h-4 w-4 accent-[rgb(var(--brand))]" />Đảo thứ tự câu (trong từng Phần)</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="shuffle_choices" defaultChecked className="h-4 w-4 accent-[rgb(var(--brand))]" />Đảo thứ tự phương án A–D</label>
          <p className="text-muted">Số lần học sinh rời khỏi trang làm bài luôn được ghi lại.</p>
        </fieldset>
        <Field label="Mật khẩu vào bài (không bắt buộc)" htmlFor="access_password" hint="Dùng khi kiểm tra tại lớp: đọc mật khẩu lúc bắt đầu.">
          <Input id="access_password" name="access_password" maxLength={40} autoComplete="off" />
        </Field>
        <Field label="Học sinh được xem" htmlFor="result_mode">
          <Select id="result_mode" name="result_mode" defaultValue="score">
            <option value="score">Chỉ điểm</option>
            <option value="score_answers">Điểm, đáp án và lời giải</option>
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
      <Button type="submit" disabled={pending} className="justify-self-start">{pending ? 'Đang giao…' : 'Giao bài và lấy link'}</Button>
    </form>
  );
}
