import { PageSkeleton, Skeleton } from '@/components/skeletons';

export default function ExamDetailLoading() {
  return (
    <div role="status" aria-label="Đang tải đề thi" className="page-enter">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-56 sm:w-80" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>
      <div className="mb-6 grid gap-3 rounded-xl border border-line bg-surface p-5 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <PageSkeleton rows={5} aside />
    </div>
  );
}
