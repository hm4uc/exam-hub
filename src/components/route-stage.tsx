'use client';
import { usePathname } from 'next/navigation';

/** Tạo hiệu ứng chuyển màn đồng bộ khi đổi đường dẫn (giữ nguyên khi chỉ đổi bộ lọc query). */
export function RouteStage({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div key={path} className="page-enter">
      {children}
    </div>
  );
}
