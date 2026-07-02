import { Suspense, useMemo, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Header, Sidebar, type TabId } from '@/shared/components/layout';
import { PageLoader } from '@/shared/components/ui/Loading/Skeletons';
import { canAccessPath, getStoredUser, ROLE_HOME_PATH } from '@/shared/utils';
import { ReadOnlyBanner } from '@/shared/components/layout/ReadOnlyBanner';

function tabFromPathname(pathname: string): TabId {
  // Expected: /dashboard/<section>
  const parts = pathname.split('/').filter(Boolean);
  const section = parts[1];

  switch (section) {
    // Overview
    case undefined:
    case 'overview': return 'dashboard';
    case 'reports':  return 'report';
    // Finance
    case 'expenses':    return 'daily_expense';
    case 'records':     return 'daily_record';
    case 'fixed-costs': return 'fixed_cost';
    case 'fund':        return 'fund';
    // Sales
    case 'pos-sync':      return 'pos_sync';
    case 'new-order':     return 'new_order';
    case 'product-list':  return 'product_list';
    case 'order-history': return 'order_history';
    // Inventory
    case 'product-costs': return 'product_cost';
    case 'suppliers':     return 'suppliers';
    // HR
    case 'staff-roster': return 'staff_roster';
    case 'payroll':      return 'payroll';
    default:             return 'dashboard';
  }
}

export function DashboardLayout() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const activeTab = useMemo(() => tabFromPathname(location.pathname), [location.pathname]);
  const user = getStoredUser();
  const homePath = user ? ROLE_HOME_PATH[user.role] : '/dashboard/overview';
  const showReadOnlyBanner = user?.role === 'visitor';

  // If someone visits exactly /dashboard, redirect to their role home.
  if (location.pathname === '/dashboard') {
    return <Navigate to={homePath} replace />;
  }

  // Block routes outside the user's allowed sections.
  if (user && !canAccessPath(user.role, location.pathname)) {
    return <Navigate to={homePath} replace />;
  }

  return (
    <div className="min-h-[100dvh] bg-[#F8FAFC] font-sans text-slate-800 flex relative overflow-x-hidden">
      {/* Mobile sidebar backdrop */}
      {isMobileMenuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <Sidebar
        activeTab={activeTab}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((v) => !v)}
      />

      <main className="flex-1 min-w-0 overflow-y-auto bg-[#F8FAFC] w-full h-[100dvh] flex flex-col">
        <Header
          activeTab={activeTab}
          onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
        />

        <div className="p-3 sm:p-4 md:p-8 max-w-[1600px] mx-auto space-y-4 sm:space-y-6 md:space-y-8 pb-[max(5rem,env(safe-area-inset-bottom))] md:pb-20 w-full min-w-0">
          {showReadOnlyBanner && <ReadOnlyBanner />}
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
