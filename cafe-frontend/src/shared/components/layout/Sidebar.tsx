import { useState, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Coffee,
  LayoutDashboard,
  FileBarChart,
  History,
  ShoppingBag,
  Building2,
  Wallet,
  ChevronRight,
  ChevronDown,
  X,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  MonitorSmartphone,
  Truck,
  Users,
  Banknote,
  ClipboardList,
  UtensilsCrossed,
  ClockArrowDown,
  Package,
  Boxes,
  Bike,
  PieChart,
  type LucideIcon,
} from 'lucide-react';
import type { SidebarProps, TabId } from './Layout.types';
import {
  getStoredUser,
  logoutAndClearSession,
  ROLE_LABELS,
  ROLE_NAV_GROUP_LABELS,
  canAccessTab,
  DASHBOARD_PATHS,
} from '@/shared/utils';
import type { StaticUserRole } from '@/shared/utils';
// ─── Types ────────────────────────────────────────────────────────────────────
interface NavItemDef {
  id: TabId;
  to: string;
  label: string;
  icon: LucideIcon;
}
interface NavGroup {
  label: string;
  /** Consistent active-state styling for the ERP navigation */
  accentClass: string;
  /** Section marker color */
  barColor: string;
  items: NavItemDef[];
}
// ─── Navigation structure ─────────────────────────────────────────────────────
const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    accentClass: 'border border-cyan-300/15 bg-cyan-400/10 text-cyan-100',
    barColor: 'bg-slate-600',
    items: [
      { id: 'dashboard', to: DASHBOARD_PATHS.dashboard, label: 'Dashboard', icon: LayoutDashboard },
      {
        id: 'manager_dashboard',
        to: DASHBOARD_PATHS.manager_dashboard,
        label: 'Manager Dashboard',
        icon: LayoutDashboard,
      },
      { id: 'report', to: DASHBOARD_PATHS.report, label: 'Financial Report', icon: FileBarChart },
      {
        id: 'product_sales',
        to: DASHBOARD_PATHS.product_sales,
        label: 'Product Sales',
        icon: PieChart,
      },
    ],
  },
  {
    label: 'Orders',
    accentClass: 'border border-cyan-300/15 bg-cyan-400/10 text-cyan-100',
    barColor: 'bg-slate-600',
    items: [
      { id: 'new_order', to: DASHBOARD_PATHS.new_order, label: 'New Order', icon: UtensilsCrossed },
      {
        id: 'order_history',
        to: DASHBOARD_PATHS.order_history,
        label: 'Order History',
        icon: ClockArrowDown,
      },
      {
        id: 'pos_sync',
        to: DASHBOARD_PATHS.pos_sync,
        label: 'Sales Sync',
        icon: MonitorSmartphone,
      },
    ],
  },
  {
    label: 'Products',
    accentClass: 'border border-cyan-300/15 bg-cyan-400/10 text-cyan-100',
    barColor: 'bg-slate-600',
    items: [
      {
        id: 'product_list',
        to: DASHBOARD_PATHS.product_list,
        label: 'Products',
        icon: ClipboardList,
      },
    ],
  },
  {
    label: 'Expenses',
    accentClass: 'border border-cyan-300/15 bg-cyan-400/10 text-cyan-100',
    barColor: 'bg-slate-600',
    items: [
      {
        id: 'daily_expense',
        to: DASHBOARD_PATHS.daily_expense,
        label: 'All Expenses',
        icon: ShoppingBag,
      },
      { id: 'product_cost', to: DASHBOARD_PATHS.product_cost, label: 'Purchases', icon: Package },
      {
        id: 'consumables',
        to: DASHBOARD_PATHS.consumables,
        label: 'Consumables & Packaging',
        icon: Boxes,
      },
      {
        id: 'fixed_cost',
        to: DASHBOARD_PATHS.fixed_cost,
        label: 'Fixed Expenses',
        icon: Building2,
      },
    ],
  },
  {
    label: 'Accounts',
    accentClass: 'border border-cyan-300/15 bg-cyan-400/10 text-cyan-100',
    barColor: 'bg-slate-600',
    items: [
      {
        id: 'daily_record',
        to: DASHBOARD_PATHS.daily_record,
        label: 'Daily Summary',
        icon: History,
      },
      { id: 'fund', to: DASHBOARD_PATHS.fund, label: 'Cash & Accounts', icon: Wallet },
      {
        id: 'delivery_settlement',
        to: DASHBOARD_PATHS.delivery_settlement,
        label: 'Delivery Payouts',
        icon: Bike,
      },
    ],
  },
  {
    label: 'Suppliers',
    accentClass: 'border border-cyan-300/15 bg-cyan-400/10 text-cyan-100',
    barColor: 'bg-slate-600',
    items: [{ id: 'suppliers', to: DASHBOARD_PATHS.suppliers, label: 'Suppliers', icon: Truck }],
  },
  {
    label: 'People',
    accentClass: 'border border-cyan-300/15 bg-cyan-400/10 text-cyan-100',
    barColor: 'bg-slate-600',
    items: [
      {
        id: 'staff_roster',
        to: DASHBOARD_PATHS.staff_roster,
        label: 'Staff Schedule',
        icon: Users,
      },
      { id: 'payroll', to: DASHBOARD_PATHS.payroll, label: 'Payroll', icon: Banknote },
    ],
  },
];
// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({
  label,
  barColor,
  isCollapsed,
  isOpen,
  onToggle,
}: {
  label: string;
  barColor: string;
  isCollapsed: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  if (isCollapsed) {
    return (
      <div className="hidden md:flex justify-center my-3">
        <div className={`w-5 h-0.5 rounded-full ${barColor} opacity-60`} />
      </div>
    );
  }
  return (
    <button
      onClick={onToggle}
      type="button"
      aria-expanded={isOpen}
      className="flex w-full items-center gap-2 px-3 pb-2 pt-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-500 group/sec"
    >
      <span className={`w-0.5 h-3 rounded-full shrink-0 ${barColor}`} />
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.13em] flex-1 text-left">
        {label}
      </span>
      <ChevronDown
        size={11}
        className={`text-slate-600 group-hover/sec:text-slate-300 transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}
      />
    </button>
  );
}
// ─── Nav item ─────────────────────────────────────────────────────────────────
function NavItem({
  item,
  isActive,
  isCollapsed,
  accentClass,
  onClose,
}: {
  item: NavItemDef;
  isActive: boolean;
  isCollapsed: boolean;
  accentClass: string;
  onClose: () => void;
}) {
  return (
    <NavLink
      to={item.to}
      onClick={onClose}
      title={isCollapsed ? item.label : undefined}
      className={[
        'flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 transition-colors duration-150 group relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400',
        isCollapsed ? 'md:justify-center md:px-0' : '',
        isActive
          ? `${accentClass} shadow-sm shadow-black/10`
          : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100',
      ].join(' ')}
    >
      {/* Active left indicator bar (expanded mode) */}
      {isActive && !isCollapsed && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-cyan-300 rounded-r-full" />
      )}
      <item.icon
        size={17}
        className={
          isActive
            ? 'text-cyan-300 shrink-0'
            : 'shrink-0 text-slate-400 transition-colors group-hover:text-slate-100'
        }
      />
      {/* Desktop label */}
      {!isCollapsed && (
        <span className="hidden md:inline text-[13px] font-medium whitespace-nowrap leading-5">
          {item.label}
        </span>
      )}
      {/* Mobile label */}
      <span className="md:hidden text-[13px] font-medium whitespace-nowrap leading-5">
        {item.label}
      </span>
      {isActive && !isCollapsed && (
        <ChevronRight size={13} className="ml-auto opacity-70 shrink-0" />
      )}
    </NavLink>
  );
}
// ─── Collapse toggle button ───────────────────────────────────────────────────
function CollapseToggle({ isCollapsed, onToggle }: { isCollapsed: boolean; onToggle: () => void }) {
  return (
    <div className="hidden border-b border-slate-800/80 md:block">
      <button
        onClick={onToggle}
        type="button"
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={`w-full flex items-center gap-2.5 px-4 py-2.5 transition-all duration-200
          text-slate-500 hover:text-slate-200 hover:bg-white/[0.06]
          ${isCollapsed ? 'justify-center' : ''}`}
      >
        {isCollapsed ? (
          <PanelLeftOpen size={16} />
        ) : (
          <>
            <PanelLeftClose size={16} />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Collapse</span>
            <span className="ml-auto text-[10px] text-slate-600 font-mono">⌘\\</span>
          </>
        )}
      </button>
    </div>
  );
}
// ─── Sidebar ──────────────────────────────────────────────────────────────────
// Scoped to the navigation list; touch scrolling remains native.
export function Sidebar({
  activeTab,
  isOpen,
  onClose,
  isCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const navigate = useNavigate();
  const userRole: StaticUserRole = getStoredUser()?.role ?? 'owner';
  // Compute dynamically filtered groups based on role permissions
  const visibleGroups = useMemo(() => {
    const allowedGroupLabels = ROLE_NAV_GROUP_LABELS[userRole];
    return NAV_GROUPS.map((group) => {
      // 1. Check if the entire group is disallowed
      if (!allowedGroupLabels.includes(group.label)) {
        return null;
      }
      // 2. Filter individual items inside the group
      const allowedItems = group.items.filter((item) => canAccessTab(userRole, item.id));
      // 3. Hide the group completely if all items inside are restricted
      if (allowedItems.length === 0) {
        return null;
      }
      // 4. Return the group with only the allowed items
      return {
        ...group,
        items: allowedItems,
      };
    }).filter(Boolean) as NavGroup[];
  }, [userRole]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(visibleGroups.map((g) => [g.label, true]))
  );
  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  const handleLogout = () => {
    try {
      logoutAndClearSession();
    } catch {
      /* ignore */
    }
    navigate('/');
  };
  return (
    <aside
      className={[
        'fixed inset-y-0 left-0 z-40 flex flex-col',
        'h-screen max-h-screen min-h-0 supports-[height:100dvh]:h-[100dvh] supports-[max-height:100dvh]:max-h-[100dvh]',
        'border-r border-slate-800 bg-slate-900 text-slate-300 shadow-xl shadow-slate-950/20',
        'transition-[width,transform] duration-200 ease-out',
        'md:translate-x-0 md:sticky md:top-0 md:h-screen md:supports-[height:100dvh]:h-[100dvh]',
        isOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64',
        isCollapsed ? 'md:w-[62px]' : 'md:w-64',
      ].join(' ')}
    >
      {/* ── Brand header ── */}
      <div
        className={`shrink-0 flex items-center border-b border-slate-800 bg-slate-900/70
          ${isCollapsed ? 'md:flex-col md:gap-0 md:py-3 md:px-0 p-4' : 'gap-3 px-4 py-3.5'}`}
      >
        {/* Logo */}
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-sm shadow-amber-950/20
          ${isCollapsed ? 'md:h-9 md:w-9' : ''}`}
        >
          <Coffee className="text-white" size={17} strokeWidth={2.5} />
        </div>
        {/* Keep one brand label across breakpoints; hide it only in collapsed desktop mode. */}
        <div className={`min-w-0 flex-1 ${isCollapsed ? 'md:hidden' : ''}`}>
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-[15px] font-bold leading-tight tracking-tight text-white">
              Nexus ERP
            </p>
            <span className="shrink-0 rounded-md border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-slate-400">
              V3.0
            </span>
          </div>
          <p className="mt-1 truncate text-[10px] font-medium text-slate-400">
            Beans &amp; Butter Café
          </p>
          <span className="mt-1.5 inline-flex rounded-full border border-amber-400/15 bg-amber-400/10 px-2 py-0.5 text-[9px] font-semibold leading-none text-amber-300">
            {ROLE_LABELS[userRole]}
          </span>
        </div>
        {/* Mobile close */}
        <button
          onClick={onClose}
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 md:hidden"
          aria-label="Close navigation"
          type="button"
        >
          <X size={18} />
        </button>
      </div>
      {/* ── Collapse toggle (desktop only, just below brand) ── */}
      <CollapseToggle isCollapsed={isCollapsed} onToggle={onToggleCollapse} />
      {/* ── Navigation ── */}
      <nav
        aria-label="Main navigation"
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-2 pb-3 scroll-smooth [scrollbar-width:thin] [scrollbar-color:rgb(71_85_105_/_0.7)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-600/70 [&::-webkit-scrollbar-thumb:hover]:bg-slate-500"
      >
        {visibleGroups.map((group) => {
          const isGroupOpen = isCollapsed || openGroups[group.label];
          return (
            <div key={group.label}>
              <SectionLabel
                label={group.label}
                barColor={group.barColor}
                isCollapsed={isCollapsed}
                isOpen={openGroups[group.label]}
                onToggle={() => toggleGroup(group.label)}
              />
              {isGroupOpen && (
                <div className="mt-0.5 space-y-0.5">
                  {group.items.map((item) => (
                    <NavItem
                      key={item.id}
                      item={item}
                      isActive={activeTab === item.id}
                      isCollapsed={isCollapsed}
                      accentClass={group.accentClass}
                      onClose={onClose}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      {/* ── Sign out — always pinned at bottom (incl. iPhone safe area) ── */}
      <div className="shrink-0 border-t border-slate-800 bg-slate-950/95 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={handleLogout}
          title={isCollapsed ? 'Sign Out' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
            text-slate-400 hover:text-rose-400 hover:bg-rose-500/10
            transition-all duration-200 group
            ${isCollapsed ? 'md:justify-center' : ''}`}
        >
          <LogOut size={16} className="shrink-0 transition-colors group-hover:text-rose-400" />
          <span className={`text-[13px] font-semibold ${isCollapsed ? 'md:sr-only' : ''}`}>
            Sign Out
          </span>
        </button>
      </div>
    </aside>
  );
}
