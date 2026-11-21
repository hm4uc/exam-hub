import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, ButtonLink, Panel } from '@/components/ui';
import { GuestCookieSync } from '@/features/attempt/guest-cookie-sync';
import { StartForm } from '@/features/attempt/start-form';
import { fmtDateTime, isCode } from '@/lib/format';
import { getMe, rpcMessage } from '@/server/auth';
import { supabaseServer } from '@/server/supabase/server';

interface Info {
  id: string;
  code: string;
  title: string;
  class_name: string | null;
  restrict_to_class: boolean;
  login_required: boolean;
  viewer_role: 'guest' | 'student' | 'teacher' | 'admin';
  opens_at: string;
  closes_at: string | null;
  duration_minutes: number;
  max_attempts: number;
  used_attempts: number;
  question_count: number;
  has_password: boolean;
  state: 'open' | 'upcoming' | 'closed' | 'no_attempts_left' | 'in_progress';
  last_attempt_id: string | null;
  guest_name: string | null;
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const normalized = code.toLowerCase();
  if (!isCode(normalized)) return { title: 'Bài kiểm tra' };
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc('assignment_info', { p_code: normalized, p_guest_key: null });
  const info = data as Info | null;
  if (!info?.title) return { title: 'Bài kiểm tra' };
  const desc = `${info.question_count} câu · ${info.duration_minutes} phút${info.class_name ? ` · Lớp ${info.class_name}` : ''} — Mở link làm bài ngay trên Exam Hub.`;
  return {
    title: info.title,
    description: desc,
    openGraph: { title: `${info.title} · Exam Hub`, description: desc },
    twitter: { title: `${info.title} · Exam Hub`, description: desc },
  };
}

export default async function AssignmentPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalized = code.toLowerCase();
  if (!isCode(normalized)) notFound();
  const me = await getMe();
  const guestCookie = (await cookies()).get('eh_guest')?.value ?? null;
  const isGuest = !me;

  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc('assignment_info', {
    p_code: normalized,
    p_guest_key: isGuest ? guestCookie : null,
  });

  if (error) {
    return (
      <main id="main-content" className="mx-auto max-w-xl px-4 py-8">
        <Alert>{rpcMessage(error)}</Alert>
        <Link href={me ? '/' : '/dang-nhap'} className="mt-4 inline-block text-sm font-semibold text-brand underline">
          {me ? 'Về trang của tôi' : 'Về trang đăng nhập'}
        </Link>
      </main>
    );
  }

  const info = data as Info;
  const isStaff = info.viewer_role === 'teacher' || info.viewer_role === 'admin';
  const left = info.max_attempts - info.used_attempts;
  const rows: [string, string][] = [
    ...(info.class_name ? [['Lớp', info.class_name] as [string, string]] : []),
    ['Số câu', String(info.question_count)],
    ['Thời gian làm', `${info.duration_minutes} phút`],
    ['Mở lúc', fmtDateTime(info.opens_at)],
    ['Đóng lúc', info.closes_at ? fmtDateTime(info.closes_at) : 'Mở đến khi giáo viên đóng'],
    ...(!isStaff ? [['Số lượt', `${info.used_attempts}/${info.max_attempts} đã dùng`] as [string, string]] : []),
  ];

  return (
    <main id="main-content" className="mx-auto max-w-xl px-4 py-6">
      {isGuest && <GuestCookieSync hasCookie={!!guestCookie} />}
      <h1 className="text-2xl font-bold tracking-tight">{info.title}</h1>
      <Panel className="mt-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="num font-medium">{v}</dd></div>
          ))}
        </dl>
      </Panel>

      <div className="mt-5">
        {isStaff ? (
          <div className="grid gap-3">
            <Alert tone="brand">
              Bạn đang mở link này bằng tài khoản {info.viewer_role === 'admin' ? 'Quản trị' : 'Giáo viên'}. Muốn làm thử như học sinh, hãy mở link ở tab ẩn danh.
            </Alert>
            <ButtonLink href={`/gv/bai-giao/${info.id}`} variant="secondary" className="w-full">
              Quản lý bài giao &amp; xem kết quả
            </ButtonLink>
          </div>
        ) : info.login_required ? (
          <div className="grid gap-3">
            <Alert tone="warn">
              Bài này chỉ dành cho học sinh lớp <b>{info.class_name}</b> đã đăng nhập.
            </Alert>
            <ButtonLink href={`/dang-nhap?next=${encodeURIComponent(`/${normalized}`)}`} className="w-full">
              Đăng nhập để làm bài
            </ButtonLink>
          </div>
        ) : (
          <>
            {info.state === 'in_progress' && (
              <>
                <Alert tone="warn" className="mb-3">
                  {info.guest_name ? `${info.guest_name} đang làm dở bài này.` : 'Bạn đang làm dở bài này.'} Đồng hồ vẫn chạy, hãy vào làm tiếp.
                </Alert>
                <ButtonLink href={`/${normalized}/lam`} className="w-full">Làm tiếp</ButtonLink>
              </>
            )}
            {info.state === 'open' && (
              <StartForm
                code={normalized}
                hasPassword={info.has_password}
                duration={info.duration_minutes}
                isGuest={isGuest}
                initialName={info.guest_name ?? ''}
              />
            )}
            {info.state === 'upcoming' && <Alert tone="neutral">Bài mở lúc {fmtDateTime(info.opens_at)}. Quay lại khi đến giờ nhé.</Alert>}
            {info.state === 'closed' && <Alert tone="neutral">Bài đã đóng{info.closes_at ? ` lúc ${fmtDateTime(info.closes_at)}` : ''}.</Alert>}
            {info.state === 'no_attempts_left' && <Alert tone="neutral">Bạn đã dùng hết {info.max_attempts} lượt làm bài.</Alert>}
            {info.last_attempt_id && info.state !== 'in_progress' && (
              <ButtonLink variant="secondary" href={`/${normalized}/ket-qua?id=${info.last_attempt_id}`} className="mt-3 w-full">
                Xem kết quả lần làm gần nhất
              </ButtonLink>
            )}
            {left > 0 && info.state === 'open' && info.used_attempts > 0 && (
              <p className="mt-2 text-center text-sm text-muted">Bạn còn {left} lượt.</p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
