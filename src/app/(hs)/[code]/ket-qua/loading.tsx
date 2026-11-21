import { AttemptReviewSkeleton } from '@/components/skeletons';

export default function ResultLoading() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <AttemptReviewSkeleton />
    </main>
  );
}
