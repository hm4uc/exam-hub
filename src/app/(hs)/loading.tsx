import { PageSkeleton } from '@/components/ui';

export default function Loading() {
  return <main className="mx-auto max-w-3xl px-4 py-6"><PageSkeleton rows={3} /></main>;
}
