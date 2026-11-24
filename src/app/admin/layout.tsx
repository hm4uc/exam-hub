import { RouteStage } from '@/components/route-stage';
import { AdminNav } from '@/components/shell/admin-nav';
import { AppHeader } from '@/components/shell/app-header';
import { requireAdmin } from '@/server/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin();
  const nav = <AdminNav />;

  return (
    <>
      <AppHeader home="/admin" width="max-w-6xl" user={{ name: me.full_name, sub: 'Quản trị hệ thống' }} nav={nav} />
      <main id="main-content" className="mx-auto max-w-6xl px-4 pb-16 pt-6" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
        <RouteStage>{children}</RouteStage>
      </main>
    </>
  );
}
