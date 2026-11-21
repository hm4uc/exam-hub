import { cx } from '@/components/ui';

/** Khối giữ chỗ có hiệu ứng ánh sáng quét mượt (tự dừng khi prefers-reduced-motion). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('skeleton-shimmer rounded-lg', className)} />;
}

/** Khung danh sách chuẩn (Tổng quan, Đề thi, Lớp, Học sinh, Bài của tôi). */
export function PageSkeleton({ rows = 5, aside = false }: { rows?: number; aside?: boolean }) {
  return (
    <div role="status" aria-label="Đang tải" className="page-enter">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <Skeleton className="h-8 w-44 sm:w-64" />
        <Skeleton className="h-10 w-36" />
      </div>
      <div className={cx('grid items-start gap-6', aside && 'lg:grid-cols-[minmax(0,1fr)_20rem]')}>
        <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-line px-4 py-4 last:border-0">
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-2/5" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
        {aside && (
          <div className="hidden gap-4 lg:grid">
            <div className="grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
            <div className="grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Khung chi tiết bài giao / thống kê 4 ô + bảng + sidebar. */
export function AssignmentResultsSkeleton() {
  return (
    <div role="status" aria-label="Đang tải bài giao" className="page-enter">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-56 sm:w-80" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-4">
          <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface shadow-card sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className={cx('grid gap-2 px-4 py-3', i % 2 === 1 && 'border-l border-line', i >= 2 && 'border-t border-line sm:border-l sm:border-t-0')}>
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-20" />
              </div>
            ))}
          </div>
          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-line px-4 py-3.5 last:border-0">
                <div className="grid flex-1 gap-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-12" />
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-4">
          <div className="grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Khung xem lại bài làm học sinh (Điểm đỏ + thanh tỷ lệ + phiếu câu hỏi + thẻ câu hỏi). */
export function AttemptReviewSkeleton() {
  return (
    <div role="status" aria-label="Đang tải bài làm" className="page-enter grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-52 sm:w-72" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid gap-4 rounded-xl border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-6">
          <Skeleton className="h-16 w-28" />
          <div className="grid flex-1 gap-2 sm:grid-cols-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-3 w-full rounded-full" />
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      <div className="grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-8 w-24 rounded-full" />)}
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="h-9 w-9 rounded-full" />)}
        </div>
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="grid gap-3 rounded-xl border border-line bg-surface p-5 shadow-card">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <div className="mt-1 grid gap-2">
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Khung trang thông tin bài thi của học sinh (/[code]). */
export function ExamCardSkeleton() {
  return (
    <main role="status" aria-label="Đang tải bài kiểm tra" className="page-enter mx-auto max-w-xl px-4 py-6">
      <Skeleton className="h-8 w-3/4" />
      <div className="mt-4 grid gap-3 rounded-xl border border-line bg-surface p-5 shadow-card">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-3">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </main>
  );
}

/** Khung phòng thi / xem trước đề (phiếu trả lời + thẻ câu hỏi). */
export function ExamRunnerSkeleton() {
  return (
    <div role="status" aria-label="Đang mở đề thi" className="page-enter mx-auto grid max-w-3xl gap-4 px-4 py-5">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
        <div className="flex justify-between"><Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-20" /></div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="h-9 w-9 rounded-full" />)}
        </div>
      </div>
      <div className="grid gap-3 rounded-xl border border-line bg-surface p-5 shadow-card">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <div className="mt-2 grid gap-2.5">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
        </div>
      </div>
    </div>
  );
}

/** Khung biểu mẫu (Tải đề, Giao bài, Tài khoản). */
export function FormSkeleton() {
  return (
    <div role="status" aria-label="Đang tải biểu mẫu" className="page-enter mx-auto max-w-3xl">
      <div className="mb-5 grid gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-52" />
      </div>
      <div className="grid gap-4 rounded-xl border border-line bg-surface p-5 shadow-card sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="grid gap-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
        <div className="sm:col-span-2"><Skeleton className="h-11 w-40" /></div>
      </div>
    </div>
  );
}

/** Khung màn quản trị Trace (/admin). */
export function AdminTraceSkeleton() {
  return (
    <div role="status" aria-label="Đang tải nhật ký" className="page-enter grid gap-5">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface shadow-card sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={cx('grid gap-2 px-4 py-3', i % 2 === 1 && 'border-l border-line', i >= 2 && 'border-t border-line sm:border-l sm:border-t-0')}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-14" />
          </div>
        ))}
      </div>
      <div className="grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-9 w-20 rounded-full" />)}
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-start gap-3 border-b border-line px-4 py-3.5 last:border-0">
            <Skeleton className="mt-1 h-4 w-4 rounded-full" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-3 w-80 max-w-full" />
            </div>
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Khung chuyển màn xuyên layout (VD: /admin ↔ /gv hoặc đăng nhập → trang chủ). */
export function RootShellSkeleton() {
  return (
    <div role="status" aria-label="Đang chuyển trang" className="min-h-dvh bg-ground">
      <div className="h-14 bg-shell shadow-[inset_0_-1px_0_rgb(255_255_255/0.08)]" />
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <PageSkeleton rows={5} />
      </div>
    </div>
  );
}
