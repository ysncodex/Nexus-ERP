import { Calendar, Menu, UserCircle2 } from 'lucide-react';
import type { HeaderProps } from './Layout.types';
import { getUserDisplayName, getUserRole, ROLE_LABELS } from '@/shared/utils';

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  manager_dashboard: 'Manager Dashboard',
  daily_record: 'Daily Summary',
  report: 'Financial Report',
  product_sales: 'Product Sales',
  daily_expense: 'All Expenses',
  product_cost: 'Purchases',
  consumables: 'Consumables & Packaging',
  fixed_cost: 'Fixed Expenses',
  fund: 'Cash & Accounts',
  delivery_settlement: 'Delivery Payouts',
  pos_sync: 'Sales Sync',
  daily_sales: 'Daily Sales',
  invoices: 'Invoices',
  new_order: 'New Order',
  order_history: 'Order History',
  product_list: 'Products',
  stock_levels: 'Stock Levels',
  suppliers: 'Suppliers',
  wastage: 'Wastage',
  staff_roster: 'Staff Schedule',
  payroll: 'Payroll',
};

const PAGE_DESCRIPTIONS: Record<string, string> = {
  dashboard: 'Overview of key financial metrics and recent activities',
  manager_dashboard: "Today's sales, orders, expenses, and drawer balances",
  report: 'Review revenue, expenses, and profit for the selected period',
  product_sales: 'Review product performance across the selected period',
  daily_expense: 'Review fixed expenses, purchases, and consumables for the month',
  daily_record: 'Day-by-day sales, expenses, and result',
  fixed_cost: 'Record rent, salaries, utilities, and other fixed expenses',
  fund: 'Move money between cash, bKash, bank, and reserve',
  product_cost: 'Record supplier purchases and review item totals',
  consumables: 'Record cups, lids, bags, boxes, napkins, straws, and other packing supplies, separate from ingredient purchases and fixed expenses',
  delivery_settlement: 'Review delivery platform statements, deductions, and deposits',
  pos_sync: 'Finish uploaded sales, offline receipts, and delivery-app connections',
  daily_sales: 'Track sales performance across all channels',
  invoices: 'Generate and manage invoices for customers and vendors',
  new_order: 'Create a café order and collect payment',
  order_history: 'Search and review previous orders',
  product_list: 'Manage products, prices, and availability',
  stock_levels: 'Monitor inventory across storage locations',
  suppliers: 'Manage supplier contacts and purchase details',
  wastage: 'Log and review spoilage and inventory wastage',
  staff_roster: 'Plan employee shifts, schedules, and attendance',
  payroll: 'Review staff salaries, bonuses, and deductions',
};

function formatPageTitle(tab: string) {
  return (
    PAGE_TITLES[tab] ??
    tab
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  );
}

export function Header({ activeTab, onMobileMenuToggle }: HeaderProps) {
  const currentDate = new Intl.DateTimeFormat('en-BD', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date());
  const userName = getUserDisplayName();
  const userRole = getUserRole();
  const roleLabel = userRole ? ROLE_LABELS[userRole] : 'Active';
  const roleBadgeClass =
    userRole === 'owner'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800';

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 shadow-sm shadow-slate-900/[0.03] backdrop-blur-xl">
      <div className="flex min-h-[68px] items-center gap-3 px-4 py-2.5 sm:px-5 lg:px-7">
        <button
          type="button"
          onClick={onMobileMenuToggle}
          className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu size={21} aria-hidden="true" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
              {formatPageTitle(activeTab)}
            </h1>
            <span
              className={`hidden shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold leading-none md:inline-flex ${roleBadgeClass}`}
            >
              {roleLabel}
            </span>
          </div>
          <p className="mt-0.5 hidden max-w-2xl text-xs leading-relaxed text-erp-secondary lg:block">
            {PAGE_DESCRIPTIONS[activeTab] ?? 'Café ERP Management System'}
          </p>
        </div>

        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <div className="flex h-10 max-w-[180px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
            <UserCircle2 size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
            <span className="truncate font-medium">{userName}</span>
          </div>
          <div className="hidden h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs font-medium text-slate-600 md:flex">
            <Calendar size={15} className="shrink-0 text-slate-400" aria-hidden="true" />
            <time>{currentDate}</time>
          </div>
        </div>
        <div className="flex h-9 shrink-0 items-center gap-1.5 text-[11px] font-medium text-slate-600 sm:hidden">
          <Calendar size={14} className="text-slate-400" aria-hidden="true" />
          <time>{currentDate}</time>
        </div>
      </div>
    </header>
  );
}
