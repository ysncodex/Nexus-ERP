/**
 * ManagerDashboard — the floor manager's cockpit.
 *
 * Answers three questions without any clicks:
 *   1. How is today going?        → KPI strip + sales mix
 *   2. Does the drawer reconcile? → Cash drawer panel with a physical count check
 *   3. What's moving?             → Recent orders + top items
 *
 * Page title/heading is provided by the app shell (Header), so none here.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  Banknote,
  CalendarDays,
  CircleDollarSign,
  Clock,
  Flame,
  Landmark,
  RefreshCw,
  ShoppingCart,
  Smartphone,
  TrendingDown,
  TrendingUp,
  Utensils,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useERP } from '@/core/context/useERP';
import { handleError } from '@/shared/utils';
import { businessDateKey, todayBusinessKey, formatBusinessTime } from '@/shared/utils/businessDate';
import { getUserDisplayName } from '@/shared/utils/staticPassword';
import {
  isLedgerExpense,
  isDeliverySettlementSale,
  type Transaction,
  type PaymentMethod,
} from '@/core/types';

// ─── Constants & formatters ───────────────────────────────────────────────────
const LOW_CASH_THRESHOLD = 2_000;
const POLL_INTERVAL_MS = 20_000;
const RECENT_ORDER_LIMIT = 2;
const TOP_ITEM_LIMIT = 2;

const money = (n: number) => `৳${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
const signedMoney = (n: number) => `${n < 0 ? '−' : '+'}${money(n)}`;
const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

const dateLabel = () =>
  new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const METHOD_META: Record<
  PaymentMethod,
  { label: string; icon: LucideIcon; tone: string; bar: string }
> = {
  cash: {
    label: 'Cash',
    icon: Banknote,
    tone: 'bg-emerald-50 text-emerald-600',
    bar: 'bg-emerald-500',
  },
  bkash: { label: 'bKash', icon: Smartphone, tone: 'bg-pink-50 text-pink-600', bar: 'bg-pink-500' },
  bank: {
    label: 'Card / bank',
    icon: Landmark,
    tone: 'bg-blue-50 text-blue-600',
    bar: 'bg-blue-500',
  },
};

const CHANNEL_META = {
  in_store: { label: 'In-store', bar: 'bg-amber-500' },
  foodpanda: { label: 'Foodpanda', bar: 'bg-rose-500' },
  foodi: { label: 'Foodi', bar: 'bg-violet-500' },
} as const;

// ─── Today's analytics ────────────────────────────────────────────────────────
interface TopItem {
  name: string;
  qty: number;
  revenue: number;
}

function useTodayStats(transactions: Transaction[]) {
  return useMemo(() => {
    const todayKey = todayBusinessKey();
    let revenue = 0;
    let orderCount = 0;
    let expenses = 0;
    const salesByMethod: Record<PaymentMethod, number> = { cash: 0, bkash: 0, bank: 0 };
    const expensesByMethod: Record<PaymentMethod, number> = { cash: 0, bkash: 0, bank: 0 };
    const salesByChannel = { in_store: 0, foodpanda: 0, foodi: 0 };
    const sales: Transaction[] = [];
    const itemMap = new Map<string, TopItem>();

    for (const t of transactions) {
      if (!t.date || businessDateKey(t.date) !== todayKey) continue;
      const amt = Number(t.amount) || 0;

      if (t.type === 'sale') {
        revenue += amt;
        if (!isDeliverySettlementSale(t)) orderCount++;
        sales.push(t);
        if (t.method) salesByMethod[t.method] += amt;
        if (t.channel && t.channel in salesByChannel) salesByChannel[t.channel] += amt;

        for (const line of t.receiptLines ?? []) {
          const qty = Number(line.qty) || 0;
          const key = line.name.trim().toLowerCase();
          const row = itemMap.get(key) ?? { name: line.name, qty: 0, revenue: 0 };
          row.qty += qty;
          row.revenue += qty * (Number(line.unitPrice) || 0);
          itemMap.set(key, row);
        }
      } else if (t.type === 'sale_adjustment') {
        // Refunds / corrections reduce both revenue and the method they were paid with.
        revenue -= amt;
        if (t.method) salesByMethod[t.method] -= amt;
      } else if (isLedgerExpense(t.type)) {
        expenses += amt;
        if (t.method) expensesByMethod[t.method] += amt;
      }
    }

    const recentOrders = sales
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, RECENT_ORDER_LIMIT);
    const topItems = [...itemMap.values()].sort((a, b) => b.qty - a.qty).slice(0, TOP_ITEM_LIMIT);

    return {
      revenue,
      orderCount,
      expenses,
      dayResult: revenue - expenses,
      avgOrder: orderCount > 0 ? revenue / orderCount : 0,
      salesByMethod,
      expensesByMethod,
      salesByChannel,
      recentOrders,
      topItems,
    };
  }, [transactions]);
}

// ─── Live refresh: poll only while visible, never overlap requests ────────────
function useLiveRefresh(refresh: (opts?: { silent?: boolean }) => Promise<unknown> | void) {
  const [lastSync, setLastSync] = useState(() => new Date());
  const [syncing, setSyncing] = useState(false);
  const inFlight = useRef(false);

  const pull = useCallback(
    async (silent = true) => {
      if (inFlight.current) return;
      inFlight.current = true;
      if (!silent) setSyncing(true);
      try {
        await refresh({ silent });
        setLastSync(new Date());
      } catch (err) {
        if (!silent) throw err; // background failures stay quiet; manual ones surface
      } finally {
        inFlight.current = false;
        setSyncing(false);
      }
    },
    [refresh]
  );

  useEffect(() => {
    const pullIfVisible = () => {
      if (document.visibilityState === 'visible') void pull(true);
    };
    const id = window.setInterval(pullIfVisible, POLL_INTERVAL_MS);
    window.addEventListener('focus', pullIfVisible);
    document.addEventListener('visibilitychange', pullIfVisible);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', pullIfVisible);
      document.removeEventListener('visibilitychange', pullIfVisible);
    };
  }, [pull]);

  return { lastSync, syncing, pull };
}

// ─── Presentational pieces ────────────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <time className="font-mono tabular-nums">
      {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </time>
  );
}

function Panel({
  title,
  subtitle,
  right,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white ${className}`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  loading,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: { text: string; chip: string };
  loading: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone.chip}`}>
          <Icon size={15} aria-hidden="true" />
        </span>
      </div>
      {loading ? (
        <div className="mt-2 h-8 w-28 animate-pulse rounded-md bg-slate-100" />
      ) : (
        <p
          className={`mt-1.5 break-words text-2xl font-bold tabular-nums leading-tight ${tone.text}`}
        >
          {value}
        </p>
      )}
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

/** One stacked bar + legend. Segments with zero value are hidden. */
function MixBar({ segments }: { segments: { label: string; value: number; bar: string }[] }) {
  const total = segments.reduce((s, x) => s + Math.max(x.value, 0), 0);
  if (total <= 0) return <p className="text-xs text-slate-400">No sales yet today</p>;
  const visible = segments.filter((s) => s.value > 0);
  return (
    <div>
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
        role="img"
        aria-label={visible.map((s) => `${s.label} ${pct(s.value, total)}%`).join(', ')}
      >
        {visible.map((s) => (
          <div key={s.label} className={s.bar} style={{ width: `${(s.value / total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {visible.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 text-slate-600">
              <span className={`h-2 w-2 rounded-full ${s.bar}`} />
              {s.label}
            </span>
            <span className="tabular-nums text-slate-500">
              <span className="font-semibold text-slate-800">{money(s.value)}</span> ·{' '}
              {pct(s.value, total)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Cash drawer reconciliation ───────────────────────────────────────────────
function DrawerPanel({
  balance,
  cashSales,
  cashExpenses,
}: {
  balance: number;
  cashSales: number;
  cashExpenses: number;
}) {
  const low = balance < LOW_CASH_THRESHOLD;
  // Opening is derived from the live balance, so it also absorbs any transfers made today.
  const opening = balance - (cashSales - cashExpenses);
  const rows: [string, string, string][] = [
    ['Opening cash (derived)', money(opening), 'text-slate-700'],
    ['Cash sales today', signedMoney(cashSales), 'text-emerald-700'],
    ['Cash expenses today', signedMoney(-cashExpenses), 'text-rose-600'],
  ];

  return (
    <Panel
      title="Cash drawer"
      subtitle="How today's cash adds up to the expected balance"
      className="h-full"
      right={
        low && (
          <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
            Low cash — refill soon
          </span>
        )
      }
    >
      <div className="flex flex-1 flex-col p-4">
        <dl className="space-y-3 text-sm">
          {rows.map(([k, v, cls]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-slate-500">{k}</dt>
              <dd className={`font-semibold tabular-nums ${cls}`}>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-auto flex items-baseline justify-between gap-3 border-t border-slate-200 pt-4">
          <span className="text-sm font-semibold text-slate-800">Expected in drawer</span>
          <span
            className={`text-2xl font-bold tabular-nums ${low ? 'text-red-600' : 'text-slate-900'}`}
          >
            {money(balance)}
          </span>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Opening cash comes from the live balance, so it includes any transfers made today.
        </p>
      </div>
    </Panel>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ManagerDashboard() {
  const { transactions, stats, isLoadingTransactions, refreshTransactions } = useERP();
  const today = useTodayStats(transactions);
  const { lastSync, syncing, pull } = useLiveRefresh(refreshTransactions);
  const managerName = getUserDisplayName();
  const initialLoad = isLoadingTransactions && transactions.length === 0;

  const handleRefresh = async () => {
    try {
      await pull(false);
      toast.success('Dashboard refreshed');
    } catch (error) {
      handleError(error, { action: 'manager_refresh', severity: 'low' });
    }
  };

  const methodSegments = (Object.keys(METHOD_META) as PaymentMethod[]).map((m) => ({
    label: METHOD_META[m].label,
    value: today.salesByMethod[m],
    bar: METHOD_META[m].bar,
  }));
  const channelSegments = (Object.keys(CHANNEL_META) as (keyof typeof CHANNEL_META)[]).map((c) => ({
    label: CHANNEL_META[c].label,
    value: today.salesByChannel[c],
    bar: CHANNEL_META[c].bar,
  }));
  const maxQty = today.topItems[0]?.qty || 1;
  const totalBalance = stats.cashBalance + stats.bkashBalance + stats.bankBalance;
  const resultPositive = today.dayResult >= 0;

  return (
    <div className="min-w-0 space-y-4 pb-6">
      {/* Greeting + refresh */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-base font-semibold text-slate-800">
            {greeting()}, {managerName}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={13} aria-hidden="true" /> {dateLabel()}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock size={13} aria-hidden="true" /> <LiveClock />
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <span className="text-xs text-slate-500">Updated {formatBusinessTime(lastSync)}</span>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={syncing || isLoadingTransactions}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Sales today"
          value={money(today.revenue)}
          hint={`Average order ${money(today.avgOrder)}`}
          icon={TrendingUp}
          tone={{ text: 'text-emerald-600', chip: 'bg-emerald-50 text-emerald-600' }}
          loading={initialLoad}
        />
        <Kpi
          label="Orders"
          value={today.orderCount.toLocaleString('en-US')}
          hint="Excludes delivery payouts"
          icon={ShoppingCart}
          tone={{ text: 'text-slate-900', chip: 'bg-amber-50 text-amber-600' }}
          loading={initialLoad}
        />
        <Kpi
          label="Expenses"
          value={money(today.expenses)}
          hint="Spent today"
          icon={TrendingDown}
          tone={{ text: 'text-rose-600', chip: 'bg-rose-50 text-rose-600' }}
          loading={initialLoad}
        />
        <Kpi
          label="Day result"
          value={`${resultPositive ? '' : '−'}${money(today.dayResult)}`}
          hint="Sales minus expenses"
          icon={CircleDollarSign}
          tone={{
            text: resultPositive ? 'text-emerald-600' : 'text-rose-600',
            chip: 'bg-blue-50 text-blue-600',
          }}
          loading={initialLoad}
        />
      </div>

      {/* Account balances: same 4-column rhythm as the KPI strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Cash drawer"
          value={money(stats.cashBalance)}
          hint={`${signedMoney(today.salesByMethod.cash)} in sales today`}
          icon={Banknote}
          tone={{
            text: stats.cashBalance < LOW_CASH_THRESHOLD ? 'text-red-600' : 'text-emerald-700',
            chip: 'bg-emerald-50 text-emerald-600',
          }}
          loading={initialLoad}
        />
        <Kpi
          label="bKash wallet"
          value={money(stats.bkashBalance)}
          hint={`${signedMoney(today.salesByMethod.bkash)} in sales today`}
          icon={Smartphone}
          tone={{ text: 'text-pink-700', chip: 'bg-pink-50 text-pink-600' }}
          loading={initialLoad}
        />
        <Kpi
          label="Card / bank"
          value={money(stats.bankBalance)}
          hint={`${signedMoney(today.salesByMethod.bank)} in sales today`}
          icon={Landmark}
          tone={{ text: 'text-blue-700', chip: 'bg-blue-50 text-blue-600' }}
          loading={initialLoad}
        />
        <Kpi
          label="Total balance"
          value={money(totalBalance)}
          hint={`${signedMoney(today.revenue)} total sales today`}
          icon={Wallet}
          tone={{ text: 'text-slate-900', chip: 'bg-slate-100 text-slate-600' }}
          loading={initialLoad}
        />
      </div>

      {/* Reconciliation + sales mix, equal height */}
      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <DrawerPanel
          balance={stats.cashBalance}
          cashSales={today.salesByMethod.cash}
          cashExpenses={today.expensesByMethod.cash}
        />
        <Panel
          title="Sales mix"
          subtitle="Where today's money came from"
          className="h-full"
          right={
            <span className="text-sm font-bold tabular-nums text-slate-900">
              Total {money(today.revenue)}
            </span>
          }
        >
          <div className="space-y-4 p-4">
            <MixBar segments={methodSegments} />
            <div className="border-t border-slate-100 pt-4">
              <MixBar segments={channelSegments} />
            </div>
          </div>
        </Panel>
      </div>

      {/* Activity: orders + top items */}
      <div className="grid items-stretch gap-4 xl:grid-cols-3">
        <Panel
          title="Recent orders"
          subtitle="Newest first"
          className="h-full xl:col-span-2"
          right={
            <span className="relative flex h-2.5 w-2.5" title="Live" aria-label="Live">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
          }
        >
          <ul className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto [scrollbar-width:thin]">
            {today.recentOrders.length === 0 ? (
              <li className="flex flex-col items-center px-4 py-10 text-center">
                <ShoppingCart size={28} className="mb-2 text-slate-300" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-600">No orders yet today</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  New sales appear here automatically.
                </p>
              </li>
            ) : (
              today.recentOrders.map((order) => {
                const meta = METHOD_META[order.method as PaymentMethod] ?? METHOD_META.bank;
                const MethodIcon = meta.icon;
                return (
                  <li
                    key={order.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.tone}`}
                    >
                      <MethodIcon size={15} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {order.description || 'Sale'}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                        {isDeliverySettlementSale(order) && (
                          <span className="rounded-md border border-orange-100 bg-orange-50 px-1.5 py-0.5 font-semibold text-orange-700">
                            Payout
                          </span>
                        )}
                        {order.orderNumber && (
                          <span className="break-all font-mono">{order.orderNumber}</span>
                        )}
                        <span>{formatBusinessTime(new Date(order.date))}</span>
                        {order.channel && (
                          <span className="capitalize">{order.channel.replace('_', '-')}</span>
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-emerald-600">
                      {money(Number(order.amount))}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
          {today.orderCount > today.recentOrders.length && (
            <p className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-center text-xs text-slate-500">
              Showing the latest {today.recentOrders.length} of {today.orderCount} orders. Open
              Order History to see all.
            </p>
          )}
        </Panel>

        <Panel title="Top items today" subtitle="By quantity sold" className="h-full">
          {today.topItems.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-10 text-center">
              <Utensils size={28} className="mb-2 text-slate-300" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-600">No itemised sales yet</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Top items appear once POS orders come in.
              </p>
            </div>
          ) : (
            <ol className="space-y-4 p-4">
              {today.topItems.map((item, i) => (
                <li key={item.name}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-800">
                      {i === 0 && (
                        <Flame size={14} className="shrink-0 text-amber-500" aria-hidden="true" />
                      )}
                      <span className="break-words">{item.name}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-slate-500">
                      <span className="font-semibold text-slate-800">{item.qty}×</span> ·{' '}
                      {money(item.revenue)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-amber-400"
                      style={{ width: `${Math.min(100, (item.qty / maxQty) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}
