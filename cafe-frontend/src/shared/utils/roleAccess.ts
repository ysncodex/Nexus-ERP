/**
 * Role-based navigation and route access.
 *
 * Centralises which dashboard sections each role may see so Sidebar,
 * route guards, and post-login redirects stay in sync.
 */

import { toast } from 'sonner';
import type { TabId } from '@/shared/components/layout/Layout.types';
import type { StaticUserRole } from './staticPassword';

/** Browser paths for each sidebar screen. Internal tab ids stay unchanged. */
export const DASHBOARD_PATHS = {
  dashboard: '/dashboard/overview',
  manager_dashboard: '/dashboard/shift',
  report: '/dashboard/financial-report',
  product_sales: '/dashboard/product-sales',
  new_order: '/dashboard/new-order',
  order_history: '/dashboard/order-history',
  pos_sync: '/dashboard/sales-sync',
  product_list: '/dashboard/products',
  daily_expense: '/dashboard/expenses',
  daily_record: '/dashboard/daily-summary',
  fixed_cost: '/dashboard/fixed-expenses',
  fund: '/dashboard/cash-accounts',
  delivery_settlement: '/dashboard/delivery-payouts',
  product_cost: '/dashboard/purchases',
  consumables: '/dashboard/consumables',
  suppliers: '/dashboard/suppliers',
  staff_roster: '/dashboard/staff-schedule',
  payroll: '/dashboard/payroll',
} as const satisfies Partial<Record<TabId, string>>;

/** Previous address segment → current segment. Keeps old bookmarks working. */
export const LEGACY_DASHBOARD_SECTIONS: Record<string, string> = {
  'manager-overview': 'shift',
  reports: 'financial-report',
  'pos-sync': 'sales-sync',
  'product-list': 'products',
  'product-costs': 'purchases',
  'fixed-costs': 'fixed-expenses',
  records: 'daily-summary',
  fund: 'cash-accounts',
  'delivery-settlements': 'delivery-payouts',
  'staff-roster': 'staff-schedule',
};

/** Default landing path after login or when visiting `/dashboard`. */
export const ROLE_HOME_PATH: Record<StaticUserRole, string> = {
  owner: DASHBOARD_PATHS.dashboard,
  manager: DASHBOARD_PATHS.manager_dashboard,
};

/** Sidebar group labels visible per role. */
export const ROLE_NAV_GROUP_LABELS: Record<StaticUserRole, readonly string[]> = {
  owner: ['Overview', 'Orders', 'Products', 'Expenses', 'Accounts', 'Suppliers', 'People'],
  // Overview is the shift dashboard. Expenses exposes purchases, consumables, and fixed expenses.
  manager: ['Overview', 'Orders', 'Products', 'Expenses'],
};

/** Human-readable role labels for UI badges. */
export const ROLE_LABELS: Record<StaticUserRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
};

/** Short descriptions shown on the login page and header. */
export const ROLE_DESCRIPTIONS: Record<StaticUserRole, string> = {
  owner: 'Full café access — orders, expenses, accounts, people, and reports.',
  manager: 'Floor operations — take orders, manage products, and record purchases, consumables, and fixed expenses.',
};

/** Toast copy when a write action is blocked. */
export const READ_ONLY_TOAST = 'Sign in as Owner or Manager to save changes.';

const READ_ONLY_TOAST_ID = 'read-only-blocked';

const MANAGER_PATHS = new Set<string>([
  DASHBOARD_PATHS.manager_dashboard,
  DASHBOARD_PATHS.new_order,
  DASHBOARD_PATHS.order_history,
  DASHBOARD_PATHS.pos_sync,
  DASHBOARD_PATHS.product_list,
  DASHBOARD_PATHS.fixed_cost,
  DASHBOARD_PATHS.product_cost,
  DASHBOARD_PATHS.consumables,
]);

/** Manager-only sections that owner should not land on. */
const MANAGER_ONLY_PATHS = new Set<string>([DASHBOARD_PATHS.manager_dashboard]);

/** Map a dashboard section slug to the current slug, including old bookmarks. */
export function canonicalDashboardSection(section: string | undefined): string {
  if (!section) return 'overview';
  return LEGACY_DASHBOARD_SECTIONS[section] ?? section;
}

/** Normalise a pathname to the section path used for access checks. */
function normalizeDashboardPath(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'dashboard') return pathname;
  return `/dashboard/${canonicalDashboardSection(parts[1])}`;
}

/** Whether the given role may mutate ERP / menu data. */
export function canMutateData(role: StaticUserRole | null | undefined): boolean {
  return role === 'owner' || role === 'manager';
}

/** Whether the signed-in user is in read-only mode. */
export function isReadOnlyUser(): boolean {
  return false;
}

/**
 * Show the read-only toast at most once at a time (Sonner dedupes by id).
 * Use for explicit user actions — not for silent load/persist paths.
 */
export function notifyReadOnlyBlocked(): void {
  toast.error(READ_ONLY_TOAST, { id: READ_ONLY_TOAST_ID });
}

/**
 * Returns true when a mutation must be blocked for the current user.
 * @param notify — when true (default), shows a single deduped toast
 */
export function blockReadOnlyMutation(notify = true): boolean {
  if (!isReadOnlyUser()) return false;
  if (notify) notifyReadOnlyBlocked();
  return true;
}

/** Whether the given role may open this dashboard route. */
export function canAccessPath(role: StaticUserRole, pathname: string): boolean {
  const path = normalizeDashboardPath(pathname);

  switch (role) {
    case 'owner':
      return path.startsWith('/dashboard/') && !MANAGER_ONLY_PATHS.has(path);
    case 'manager':
      return MANAGER_PATHS.has(path);
    default:
      return false;
  }
}

/** Whether a sidebar tab id is reachable for the given role. */
export function canAccessTab(role: StaticUserRole, tabId: TabId): boolean {
  const tabToPath: Partial<Record<TabId, string>> = DASHBOARD_PATHS;

  const path = tabToPath[tabId];
  return path ? canAccessPath(role, path) : false;
}
