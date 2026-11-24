'use client';
import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/components/ui';

const ITEMS = [
  { href: '/admin', label: 'Nhật ký & sự cố', exact: true },
  { href: '/admin/giao-vien', label: 'Giáo viên', exact: false },
  { href: '/gv', label: 'Trang giáo viên', exact: true },
];

function Indicator({ active }: { active: boolean }) {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={cx('absolute inset-x-3 bottom-0 h-0.5 rounded-full transition-opacity', pending ? 'animate-pulse bg-shell-ink/70 opacity-100' : active ? 'bg-shell-ink opacity-100' : 'opacity-0')} />;
}

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Quản trị" className="flex overflow-x-auto [scrollbar-width:none]">
      {ITEMS.map((i) => {
        const active = i.exact ? path === i.href : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} aria-current={active ? 'page' : undefined}
            className={cx('relative inline-flex min-h-12 items-center whitespace-nowrap px-3 text-sm font-medium transition-colors md:min-h-14', active ? 'text-shell-ink' : 'text-shell-muted hover:text-shell-ink')}>
            {i.label}
            <Indicator active={active} />
          </Link>
        );
      })}
    </nav>
  );
}
