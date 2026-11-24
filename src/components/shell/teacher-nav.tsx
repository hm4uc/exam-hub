'use client';
import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/components/ui';

const ITEMS = [
  { href: '/gv', label: 'Tổng quan', exact: true },
  { href: '/gv/de', label: 'Đề thi' },
  { href: '/gv/lop', label: 'Lớp' },
  { href: '/gv/hoc-sinh', label: 'Học sinh' },
];

/** Vạch dưới mục đang chọn; nhấp nháy ngay khi bấm để báo đang chuyển trang. */
function Indicator({ active }: { active: boolean }) {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={cx('absolute inset-x-3 bottom-0 h-0.5 rounded-full transition-opacity', pending ? 'animate-pulse bg-shell-ink/70 opacity-100' : active ? 'bg-shell-ink opacity-100' : 'opacity-0')} />;
}

export function TeacherNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const path = usePathname();
  const items = isAdmin ? [...ITEMS, { href: '/admin', label: 'Quản trị', exact: false }] : ITEMS;
  return (
    <nav aria-label="Chính" className="flex overflow-x-auto [scrollbar-width:none]">
      {items.map((i) => {
        const active = i.exact ? path === i.href : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} aria-current={active ? 'page' : undefined}
            className={cx('relative inline-flex min-h-12 items-center whitespace-nowrap px-3 text-sm font-medium transition-colors md:min-h-14',
              active ? 'text-shell-ink' : 'text-shell-muted hover:text-shell-ink')}>
            {i.label}
            <Indicator active={active} />
          </Link>
        );
      })}
    </nav>
  );
}
