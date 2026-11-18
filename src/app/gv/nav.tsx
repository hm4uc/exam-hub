'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/gv', label: 'Tổng quan', exact: true },
  { href: '/gv/de', label: 'Đề thi' },
  { href: '/gv/lop', label: 'Lớp' },
  { href: '/gv/hoc-sinh', label: 'Học sinh' },
];

export function GvNav() {
  const path = usePathname();
  return (
    <nav aria-label="Chính" className="-mx-1 flex overflow-x-auto">
      {ITEMS.map((i) => {
        const active = i.exact ? path === i.href : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} aria-current={active ? 'page' : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${active ? 'bg-white/15 text-brand-on' : 'text-brand-on/80 hover:bg-white/10 hover:text-brand-on'}`}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
