/**
 * Role-based navigation and route access.
 *
 * Centralises which dashboard sections each role may see so Sidebar,
 * route guards, and post-login redirects stay in sync.
 */

import { toast } from 'sonner';
import type { TabId } from '@/shared/components/layout/Layout.types';
import { getStoredUser, type StaticUserRole } from './staticPassword';

/** Default landing path after login or when visiting `/dashboard`. */
export const ROLE_HOME_PATH: Record<StaticUserRole, string> = {
  owner: '/dashboard/overview',
  manager: '/dashboard/new-order',
  visitor: '/dashboard/overview',
};

/** Sidebar group labels visible per role. */
export const ROLE_NAV_GROUP_LABELS: Record<StaticUserRole, readonly string[]> = {
  owner: ['Overview', 'Orders', 'Products', 'Finance', 'Inventory', 'HR & Team'],
  manager: ['Orders', 'Products'],
  /** Visitors browse every section; mutations are blocked elsewhere. */
  visitor: ['Overview', 'Orders', 'Products', 'Finance', 'Inventory', 'HR & Team'],
};

/** Human-readable role labels for UI badges. */
export const ROLE_LABELS: Record<StaticUserRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  visitor: 'Visitor',
};

/** Short descriptions shown on the login page and header. */
export const ROLE_DESCRIPTIONS: Record<StaticUserRole, string> = {
  owner: 'Full access to every module — finance, inventory, HR, and reports.',
  manager: 'Day-to-day operations — take orders, review history, and manage the menu.',
  visitor:
    'Browse the full dashboard in read-only mode — explore every page without changing data.',
};

/** Toast copy when a visitor attempts a write action. */
export const READ_ONLY_TOAST =
  'Read-only preview — sign in as Owner or Manager to save changes.';

const READ_ONLY_TOAST_ID = 'read-only-blocked';

const MANAGER_PATHS = new Set([
  '/dashboard/new-order',
  '/dashboard/order-history',
  '/dashboard/pos-sync',
  '/dashboard/product-list',
]);

/** Normalise a pathname to the section path used for access checks. */
function normalizeDashboardPath(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'dashboard') return pathname;
  if (parts.length <= 1) return '/dashboard/overview';
  return `/dashboard/${parts[1]}`;
}

/** Whether the given role may mutate ERP / menu data. */
export function canMutateData(role: StaticUserRole | null | undefined): boolean {
  return role === 'owner' || role === 'manager';
}

/** Whether the signed-in user is in read-only visitor mode. */
export function isReadOnlyUser(): boolean {
  return getStoredUser()?.role === 'visitor';
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
    case 'visitor':
      return path.startsWith('/dashboard/');
    case 'manager':
      return MANAGER_PATHS.has(path);
    default:
      return false;
  }
}

/** Whether a sidebar tab id is reachable for the given role. */
export function canAccessTab(role: StaticUserRole, tabId: TabId): boolean {
  const tabToPath: Partial<Record<TabId, string>> = {
    dashboard: '/dashboard/overview',
    report: '/dashboard/reports',
    new_order: '/dashboard/new-order',
    order_history: '/dashboard/order-history',
    pos_sync: '/dashboard/pos-sync',
    product_list: '/dashboard/product-list',
    daily_expense: '/dashboard/expenses',
    daily_record: '/dashboard/records',
    fixed_cost: '/dashboard/fixed-costs',
    fund: '/dashboard/fund',
    product_cost: '/dashboard/product-costs',
    suppliers: '/dashboard/suppliers',
    staff_roster: '/dashboard/staff-roster',
    payroll: '/dashboard/payroll',
  };

  const path = tabToPath[tabId];
  return path ? canAccessPath(role, path) : false;
}
