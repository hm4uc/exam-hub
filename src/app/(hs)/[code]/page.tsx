import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, ButtonLink, Panel } from '@/components/ui';
import { rpcMessage } from '@/lib/auth';
import { fmtDateTime, isCode } from '@/lib/format';
import { supabaseServer } from '@/lib/supabase/server';
import { StartForm } from './start-form';

export const metadata: Metadata = { title: 'Bài kiểm tra' };

interface Info {
  code: string; title: string; class_name: string; opens_at: string; closes_at: string; duration_minutes: number;
  max_attempts: number; used_attempts: number; question_count: number; has_password: boolean;
  state: 'open' | 'upcoming' | 'closed' | 'no_attempts_left' | 'in_progress'; last_attempt_id: string | null;
}

export default async function AssignmentPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!isCode(code)) notFound();
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc('assignment_info', { p_code: code });
  if (error) {
    return (
      <main className="mx-auto max-w-xl px-4 py-8">
        <Alert>{rpcMessage(error)}</Alert>
        <Link href="/" className="mt-4 inline-block text-sm font-semibold text-brand underline">Về trang của tôi</Link>
      </main>
    );
  }
  const info = data as Info;
  const left = info.max_attempts - info.used_attempts;
  const rows: [string, string][] = [
    ['Lớp', info.class_name],
    ['Số câu', String(info.question_count)],
    ['Thời gian làm', `${info.duration_minutes} phút`],
    ['Mở lúc', fmtDateTime(info.opens_at)],
    ['Đóng lúc', fmtDateTime(info.closes_at)],
    ['Số lượt', `${info.used_attempts}/${info.max_attempts} đã dùng`],
  ];

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">{info.title}</h1>
      <Panel className="mt-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="num font-medium">{v}</dd></div>
          ))}
        </dl>
      </Panel>

      <div className="mt-5">
        {info.state === 'in_progress' && (
          <>
            <Alert tone="warn" className="mb-3">Bạn đang làm dở bài này. Đồng hồ vẫn chạy, hãy vào làm tiếp.</Alert>
            <ButtonLink href={`/${code}/lam`} className="w-full">Làm tiếp</ButtonLink>
          </>
        )}
        {info.state === 'open' && (
          <StartForm code={code} hasPassword={info.has_password} duration={info.duration_minutes} />
        )}
        {info.state === 'upcoming' && <Alert tone="neutral">Bài mở lúc {fmtDateTime(info.opens_at)}. Quay lại khi đến giờ nhé.</Alert>}
        {info.state === 'closed' && <Alert tone="neutral">Bài đã đóng lúc {fmtDateTime(info.closes_at)}.</Alert>}
        {info.state === 'no_attempts_left' && <Alert tone="neutral">Bạn đã dùng hết {info.max_attempts} lượt làm bài.</Alert>}
        {info.last_attempt_id && info.state !== 'in_progress' && (
          <ButtonLink variant="secondary" href={`/${code}/ket-qua?id=${info.last_attempt_id}`} className="mt-3 w-full">Xem kết quả lần làm gần nhất</ButtonLink>
        )}
        {left > 0 && info.state === 'open' && info.used_attempts > 0 && <p className="mt-2 text-center text-sm text-muted">Bạn còn {left} lượt.</p>}
      </div>
    </main>
  );
}
