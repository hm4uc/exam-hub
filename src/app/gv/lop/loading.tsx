import { PageSkeleton } from '@/components/skeletons';

export default function ClassesLoading() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageSkeleton rows={5} />
    </div>
  );
}
