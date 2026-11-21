import { Skeleton } from '@/components/skeletons';

export default function AuthLoading() {
  return (
    <div role="status" aria-label="Đang tải" className="grid gap-4">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-4 w-56" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}
