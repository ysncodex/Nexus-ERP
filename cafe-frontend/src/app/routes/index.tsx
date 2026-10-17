import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LEGACY_DASHBOARD_SECTIONS } from '@/shared/utils';
import { DashboardLayout } from '@/app/layouts/DashboardLayout';
import { ProtectedProviders } from '@/app/providers/AppProviders';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { ToastProvider } from '@/shared/components/ui';
import { PageLoader } from '@/shared/components/ui/Loading/Skeletons';

// ── Auth / misc (lazy so the 1.9MB-free login chunk stays off the critical path) ─
const LoginPage = lazy(() => import('@/features/auth/Login'));
const TestComponents = lazy(() => import('@/pages/TestComponents'));

// ── Dashboard ─────────────────────────────────────────────────────────────────
const Dashboard = lazy(() => import('@/modules/dashboard/pages/Dashboard'));
const ManagerDashboard = lazy(() => import('@/modules/dashboard/pages/ManagerDashboard'));

// ── Finance ───────────────────────────────────────────────────────────────────
const DailyExpense   = lazy(() => import('@/modules/finance/pages/DailyExpense'));
const DailyRecord    = lazy(() => import('@/modules/finance/pages/DailyRecord'));
const FixedCosts     = lazy(() => import('@/modules/finance/pages/FixedCosts'));
const Consumables    = lazy(() => import('@/modules/finance/pages/Consumables'));
const FundManagement = lazy(() => import('@/modules/finance/pages/FundManagement'));
const DeliverySettlements = lazy(() => import('@/modules/finance/pages/DeliverySettlements'));

// ── Sales ─────────────────────────────────────────────────────────────────────
const NewOrder     = lazy(() => import('@/modules/sales/pages/NewOrder'));
const ItemList     = lazy(() => import('@/modules/sales/pages/ItemList'));
const OrderHistory = lazy(() => import('@/modules/sales/pages/OrderHistory'));
const PosSync      = lazy(() => import('@/modules/sales/pages/PosSync'));

// ── Inventory ─────────────────────────────────────────────────────────────────
const ProductCosts = lazy(() => import('@/modules/inventory/pages/ProductCosts'));
const Suppliers    = lazy(() => import('@/modules/inventory/pages/Suppliers'));

// ── HR ────────────────────────────────────────────────────────────────────────
const StaffRoster = lazy(() => import('@/modules/hr/pages/StaffRoster'));
const Payroll     = lazy(() => import('@/modules/hr/pages/Payroll'));

// ── Reports ───────────────────────────────────────────────────────────────────
const Reports = lazy(() => import('@/modules/reports/pages/Reports'));
const ProductSalesAnalysis = lazy(() => import('@/modules/reports/pages/ProductSalesAnalysis'));

function LegacySectionRedirect({ section }: { section: string }) {
  const location = useLocation();
  return (
    <Navigate
      to={{ pathname: `/dashboard/${section}`, search: location.search, hash: location.hash }}
      replace
    />
  );
}

export function AppRoutes() {
  return (
    <ErrorBoundary>
      <ToastProvider />
      <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/"                 element={<LoginPage />} />
        <Route path="/test-components"  element={<TestComponents />} />

        {/* Protected dashboard shell */}
        <Route
          path="/dashboard"
          element={
            <ProtectedProviders>
              <DashboardLayout />
            </ProtectedProviders>
          }
        >
          {/* Dashboard */}
          <Route path="overview" element={<Dashboard />} />
          <Route path="shift" element={<ManagerDashboard />} />

          <Route path="expenses" element={<DailyExpense />} />
          <Route path="daily-summary" element={<DailyRecord />} />
          <Route path="fixed-expenses" element={<FixedCosts />} />
          <Route path="consumables" element={<Consumables />} />
          <Route path="cash-accounts" element={<FundManagement />} />
          <Route path="delivery-payouts" element={<DeliverySettlements />} />

          <Route path="new-order" element={<NewOrder />} />
          <Route path="products" element={<ItemList />} />
          <Route path="order-history" element={<OrderHistory />} />
          <Route path="sales-sync" element={<PosSync />} />

          <Route path="purchases" element={<ProductCosts />} />
          <Route path="suppliers" element={<Suppliers />} />

          <Route path="staff-schedule" element={<StaffRoster />} />
          <Route path="payroll" element={<Payroll />} />

          <Route path="financial-report" element={<Reports />} />
          <Route path="product-sales" element={<ProductSalesAnalysis />} />

          {Object.entries(LEGACY_DASHBOARD_SECTIONS).map(([from, to]) => (
            <Route key={from} path={from} element={<LegacySectionRedirect section={to} />} />
          ))}
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
