import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/app/layouts/DashboardLayout';
import { ProtectedProviders } from '@/app/providers/AppProviders';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { ToastProvider } from '@/shared/components/ui';
import LoginPage from '@/features/auth/Login';
import TestComponents from '@/pages/TestComponents';

// ── Dashboard ─────────────────────────────────────────────────────────────────
const Dashboard = lazy(() => import('@/modules/dashboard/pages/Dashboard'));

// ── Finance ───────────────────────────────────────────────────────────────────
const DailyExpense   = lazy(() => import('@/modules/finance/pages/DailyExpense'));
const DailyRecord    = lazy(() => import('@/modules/finance/pages/DailyRecord'));
const FixedCosts     = lazy(() => import('@/modules/finance/pages/FixedCosts'));
const FundManagement = lazy(() => import('@/modules/finance/pages/FundManagement'));

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

export function AppRoutes() {
  return (
    <ErrorBoundary>
      <ToastProvider />
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

          {/* Finance */}
          <Route path="expenses"      element={<DailyExpense />} />
          <Route path="records"       element={<DailyRecord />} />
          <Route path="fixed-costs"   element={<FixedCosts />} />
          <Route path="fund"          element={<FundManagement />} />

          {/* Sales */}
          <Route path="new-order"      element={<NewOrder />} />
          <Route path="product-list"   element={<ItemList />} />
          <Route path="order-history"  element={<OrderHistory />} />
          <Route path="pos-sync"       element={<PosSync />} />

          {/* Inventory */}
          <Route path="product-costs" element={<ProductCosts />} />
          <Route path="suppliers"     element={<Suppliers />} />

          {/* HR */}
          <Route path="staff-roster" element={<StaffRoster />} />
          <Route path="payroll"      element={<Payroll />} />

          {/* Reports */}
          <Route path="reports" element={<Reports />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
