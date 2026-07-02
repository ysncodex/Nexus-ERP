/**
 * Dashboard — main overview page.
 *
 * Layout (desktop): two equal columns side-by-side
 *   LEFT  → Today's live overview  (revenue, expenses, payment breakdown, top orders)
 *   RIGHT → Selected-period sales  (payment methods, channels, profit, reserve fund)
 *
 * Data flows:
 *   • `transactions`         — ALL records, used for today's stats
 *   • `filteredTransactions` — date-range-filtered records, used for period stats
 *   • `stats`                — pre-computed ERP aggregates (cash balance, fund total, etc.)
 */

// ─── Imports ──────────────────────────────────────────────────────────────────

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  TrendingUp,
  TrendingDown,
  Banknote,
  Smartphone,
  Landmark,
  Store,
  Bike,
  Utensils,
  PlusCircle,
  Clock,
  ShoppingCart,
  CircleDollarSign,
  CalendarDays,
  Wallet,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Target,
  Zap,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';

import { useERP } from '@/core/context/useERP';
import { ButtonLoading } from '@/shared/components/ui';
import { saleSchema, type SaleFormData, handleError } from '@/shared/utils';
import { businessDateKey, todayBusinessKey } from '@/shared/utils/businessDate';
import { useCanMutate } from '@/shared/hooks';

// ─── Static config ────────────────────────────────────────────────────────────

/** Payment method display config — used in both today and period panels. */
const PAYMENT_METHODS = [
  {
    key: 'cash' as const,
    label: 'Cash',
    icon: Banknote,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-700',
    bar: 'bg-emerald-400',
  },
  {
    key: 'bkash' as const,
    label: 'bKash',
    icon: Smartphone,
    iconBg: 'bg-pink-50',
    iconColor: 'text-pink-700',
    bar: 'bg-pink-400',
  },
  {
    key: 'bank' as const,
    label: 'Card / Bank',
    icon: Landmark,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-700',
    bar: 'bg-blue-400',
  },
] as const;

/** Sales channel display config — used in the period panel.
 *  `dataKey` matches the property name in the period stats object. */
const SALES_CHANNELS = [
  {
    key: 'in_store' as const,
    dataKey: 'inStore' as const,
    label: 'In-Store',
    icon: Store,
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-700',
    bar: 'bg-teal-400',
  },
  {
    key: 'foodpanda' as const,
    dataKey: 'foodpanda' as const,
    label: 'Foodpanda',
    icon: Bike,
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-700',
    bar: 'bg-orange-400',
  },
  {
    key: 'foodi' as const,
    dataKey: 'foodi' as const,
    label: 'Foodi',
    icon: Utensils,
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-700',
    bar: 'bg-violet-400',
  },
] as const;

// ─── Utility functions ────────────────────────────────────────────────────────

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Formats a Date to a short time string, e.g. "02:45 PM". */
function formatTime(date: Date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

/** Formats a Date to a short date string, e.g. "Sat, Jun 27". */
function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

interface SelectedMonth {
  year: number;
  month: number;
}

function MonthNavigator({
  label,
  onPrev,
  onNext,
  disableNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  disableNext: boolean;
}) {
  return (
    <div className="flex items-center gap-1 bg-white/10 border border-white/20 rounded-xl px-2 py-1.5 shadow-sm backdrop-blur-sm">
      <button
        type="button"
        onClick={onPrev}
        aria-label="Previous month"
        className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
      >
        <ChevronLeft size={15} />
      </button>
      <span className="text-sm font-bold text-white min-w-[130px] text-center select-none px-1">
        {label}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={disableNext}
        aria-label="Next month"
        className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

// ─── Small reusable components ────────────────────────────────────────────────

/** Ticking clock, updates every second. */
function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono tabular-nums">
      {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

/** Thin labelled divider used to separate sections inside a card. */
function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
}

/** One labelled row with a value, percentage badge, and a progress bar. */
function StatRow({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  pct,
  barColor,
}: {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number;
  pct: number;
  barColor: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
            <Icon size={12} className={iconColor} />
          </div>
          <span className="text-xs font-semibold text-slate-700">{label}</span>
        </div>
        <div className="text-right">
          <span className="text-sm font-bold text-slate-800 tabular-nums">
            ৳{value.toLocaleString()}
          </span>
          <span className="text-[11px] text-slate-400 ml-1.5">{pct.toFixed(0)}%</span>
        </div>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

/** Stacked colour bar representing a set of values as proportional segments. */
function StackedBar({ segments }: { segments: { color: string; pct: number }[] }) {
  return (
    <div className="flex h-2 rounded-full overflow-hidden gap-px mt-3">
      {segments.map((segment, index) => (
        <div
          key={index}
          className={`${segment.color} transition-all duration-700`}
          style={{ width: `${Math.min(100, segment.pct)}%` }}
        />
      ))}
    </div>
  );
}

type InsightType = 'success' | 'warning' | 'danger' | 'info';
interface InsightItem {
  type: InsightType;
  title: string;
  desc: string;
  icon: LucideIcon;
}

const INSIGHT_STYLES: Record<
  InsightType,
  { bg: string; border: string; icon: string; title: string; desc: string }
> = {
  success: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: 'text-emerald-600',
    title: 'text-emerald-800',
    desc: 'text-emerald-700',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: 'text-amber-600',
    title: 'text-amber-800',
    desc: 'text-amber-700',
  },
  danger: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    icon: 'text-rose-600',
    title: 'text-rose-800',
    desc: 'text-rose-700',
  },
  info: {
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    icon: 'text-sky-600',
    title: 'text-sky-800',
    desc: 'text-sky-700',
  },
};

/** Small card for a single smart insight. */
function InsightCard({ insight }: { insight: InsightItem }) {
  const style = INSIGHT_STYLES[insight.type];
  return (
    <div className={`flex items-start gap-3 p-3.5 rounded-xl border ${style.bg} ${style.border}`}>
      <insight.icon size={14} className={`${style.icon} shrink-0 mt-0.5`} />
      <div className="min-w-0">
        <p className={`text-xs font-bold ${style.title}`}>{insight.title}</p>
        <p className={`text-[11px] mt-0.5 leading-relaxed ${style.desc}`}>{insight.desc}</p>
      </div>
    </div>
  );
}

// ─── Custom hooks ─────────────────────────────────────────────────────────────

/** Returns today's sales totals broken down by payment method + top orders by amount. */
function useTodayStats(transactions: ReturnType<typeof useERP>['transactions']) {
  return useMemo(() => {
    const todayKey = todayBusinessKey();

    let revenue = 0,
      orderCount = 0,
      expenses = 0;
    let cash = 0,
      bkash = 0,
      bank = 0;
    const todaySales: typeof transactions = [];

    for (const transaction of transactions) {
      if (!transaction.date) continue;
      if (businessDateKey(transaction.date) !== todayKey) continue;

      if (transaction.type === 'sale') {
        revenue += transaction.amount;
        orderCount++;
        todaySales.push(transaction);
        if (transaction.method === 'cash') cash += transaction.amount;
        if (transaction.method === 'bkash') bkash += transaction.amount;
        if (transaction.method === 'bank') bank += transaction.amount;
      }
      if (transaction.type === 'sale_adjustment') {
        revenue -= transaction.amount;
        if (transaction.method === 'cash') cash -= transaction.amount;
        if (transaction.method === 'bkash') bkash -= transaction.amount;
        if (transaction.method === 'bank') bank -= transaction.amount;
      }
      if (transaction.type === 'expense_product' || transaction.type === 'expense_fixed') {
        expenses += transaction.amount;
      }
    }

    const topOrders = [...todaySales].sort((a, b) => b.amount - a.amount).slice(0, 3);

    return { revenue, orderCount, expenses, cash, bkash, bank, topOrders };
  }, [transactions]);
}

/** Returns up to 4 actionable business insights based on current stats and period data. */
function useInsights(
  period: {
    cash: number;
    bkash: number;
    bank: number;
    inStore: number;
    foodpanda: number;
    foodi: number;
    expenses: number;
    totalSales: number;
    profit: number;
  },
  stats: ReturnType<typeof useERP>['stats']
): InsightItem[] {
  return useMemo(() => {
    const insightList: InsightItem[] = [];
    const profitMargin = period.totalSales > 0 ? (period.profit / period.totalSales) * 100 : 0;
    const expenseRatio = period.totalSales > 0 ? (period.expenses / period.totalSales) * 100 : 0;

    // Cash drawer health
    if (stats.cashBalance < 2_000)
      insightList.push({
        type: 'danger',
        icon: AlertTriangle,
        title: 'Low Cash Drawer',
        desc: `Only ৳${stats.cashBalance.toLocaleString()} in cash. Refill or release from fund.`,
      });
    else if (stats.cashBalance > 30_000)
      insightList.push({
        type: 'warning',
        icon: AlertCircle,
        title: 'Excess Cash',
        desc: `৳${stats.cashBalance.toLocaleString()} in drawer — consider moving to reserve fund.`,
      });

    // Profit health
    if (profitMargin > 20)
      insightList.push({
        type: 'success',
        icon: CheckCircle2,
        title: 'Healthy Profit',
        desc: `${profitMargin.toFixed(1)}% margin this period — excellent performance.`,
      });
    else if (expenseRatio > 80 && period.totalSales > 0)
      insightList.push({
        type: 'danger',
        icon: AlertTriangle,
        title: 'High Expense Ratio',
        desc: `Expenses are ${expenseRatio.toFixed(0)}% of revenue — margins under pressure.`,
      });

    // Monthly revenue projection based on daily average so far
    if (period.totalSales > 0) {
      const dayOfMonth = new Date().getDate();
      const daysInMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        0
      ).getDate();
      const projectedMonthlyRevenue = Math.round((period.totalSales / dayOfMonth) * daysInMonth);
      insightList.push({
        type: 'info',
        icon: Target,
        title: 'Monthly Projection',
        desc: `On pace for ~৳${projectedMonthlyRevenue.toLocaleString()} this month (Day ${dayOfMonth}/${daysInMonth}).`,
      });
    }

    return insightList.slice(0, 4);
  }, [period, stats]);
}

// ─── Sub-panels ───────────────────────────────────────────────────────────────

/** The "Quick Record Sale" collapsible form inside the today panel. */
function QuickSaleForm({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  const { addTransaction } = useERP();
  const [isSubmittingToServer, setIsSubmittingToServer] = useState(false);
  const [saleDate, setSaleDate] = useState(todayISO);
  const maxSelectableDate = todayISO();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
  } = useForm<SaleFormData>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      amount: '',
      method: 'cash',
      channel: 'in_store',
      description: '',
      isAdjustment: false,
    },
  });

  const selectedChannel = watch('channel');
  const selectedPaymentMethod = watch('method');

  const onSubmit = async (formData: SaleFormData) => {
    try {
      setIsSubmittingToServer(true);
      const [year, month, day] = saleDate.split('-').map(Number);
      addTransaction({
        type: formData.isAdjustment ? 'sale_adjustment' : 'sale',
        amount: Number(formData.amount),
        method: formData.method,
        channel: formData.channel,
        description: formData.description,
        date: new Date(year, month - 1, day),
      });
      toast.success(`Sale of ৳${Number(formData.amount).toLocaleString()} recorded!`);
      reset({
        amount: '',
        method: formData.method,
        channel: formData.channel,
        description: '',
        isAdjustment: false,
      });
      setSaleDate(todayISO());
      onToggle(); // collapse form after successful submission
    } catch (error) {
      handleError(error, {
        action: 'add_sale',
        severity: 'high',
        metadata: { amount: formData.amount },
      });
    } finally {
      setIsSubmittingToServer(false);
    }
  };

  const fieldClass = (hasError: boolean) =>
    `w-full px-3 py-2 rounded-xl border text-sm outline-none transition-all ${
      hasError
        ? 'border-red-300 focus:ring-2 focus:ring-red-100'
        : 'border-slate-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100'
    }`;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Toggle header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <PlusCircle size={15} className="text-emerald-600" />
          Quick Record Sale
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="px-4 pb-4 pt-3 space-y-3 border-t border-slate-100"
        >
          {/* Amount + Date */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                Amount (৳)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('amount')}
                placeholder="0.00"
                className={fieldClass(!!errors.amount)}
              />
              {errors.amount && (
                <p className="text-[11px] text-red-500 mt-0.5">{errors.amount.message}</p>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                Date
              </label>
              <input
                type="date"
                value={saleDate}
                max={maxSelectableDate}
                onChange={(e) => setSaleDate(e.target.value)}
                className={fieldClass(false)}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
              Description
            </label>
            <input
              type="text"
              {...register('description')}
              placeholder="e.g. Cappuccino, Lunch Set…"
              className={fieldClass(!!errors.description)}
            />
            {errors.description && (
              <p className="text-[11px] text-red-500 mt-0.5">{errors.description.message}</p>
            )}
          </div>

          {/* Channel + Payment selectors */}
          <div className="grid grid-cols-2 gap-2">
            {/* Channel */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                Channel
              </label>
              <div className="flex gap-1">
                {[
                  { value: 'in_store' as const, label: 'Store', Icon: Store },
                  { value: 'foodpanda' as const, label: 'Panda', Icon: Bike },
                  { value: 'foodi' as const, label: 'Foodi', Icon: Utensils },
                ].map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setValue('channel', value)}
                    className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl border text-[10px] font-bold transition-all ${
                      selectedChannel === value
                        ? 'border-amber-400 bg-amber-50 text-amber-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <Icon size={11} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment method */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                Payment
              </label>
              <div className="flex gap-1">
                {[
                  { value: 'cash' as const, label: 'Cash', Icon: Banknote },
                  { value: 'bkash' as const, label: 'bKash', Icon: Smartphone },
                  { value: 'bank' as const, label: 'Card', Icon: Landmark },
                ].map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setValue('method', value)}
                    className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl border text-[10px] font-bold transition-all ${
                      selectedPaymentMethod === value
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <Icon size={11} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <ButtonLoading
            loading={isSubmitting || isSubmittingToServer}
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
          >
            <PlusCircle size={14} /> Record Sale
          </ButtonLoading>
        </form>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { transactions, stats } = useERP();
  const canMutate = useCanMutate();
  const [showSaleForm, setShowSaleForm] = useState(false);
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<SelectedMonth>({
    year: currentDate.getFullYear(),
    month: currentDate.getMonth(),
  });

  // Computed stats
  const today = useTodayStats(transactions);
  const monthStart = useMemo(
    () => new Date(selectedMonth.year, selectedMonth.month, 1),
    [selectedMonth]
  );
  const monthEnd = useMemo(
    () => new Date(selectedMonth.year, selectedMonth.month + 1, 0, 23, 59, 59, 999),
    [selectedMonth]
  );
  const monthTransactions = useMemo(
    () =>
      transactions.filter((transaction) => {
        if (!(transaction.date instanceof Date)) return false;
        return transaction.date >= monthStart && transaction.date <= monthEnd;
      }),
    [monthStart, monthEnd, transactions]
  );
  const period = useMemo(() => {
    let cash = 0,
      bkash = 0,
      bank = 0;
    let inStore = 0,
      foodpanda = 0,
      foodi = 0;
    let expenses = 0;

    for (const transaction of monthTransactions) {
      if (transaction.type === 'sale') {
        if (transaction.method === 'cash') cash += transaction.amount;
        if (transaction.method === 'bkash') bkash += transaction.amount;
        if (transaction.method === 'bank') bank += transaction.amount;
        if (transaction.channel === 'in_store') inStore += transaction.amount;
        if (transaction.channel === 'foodpanda') foodpanda += transaction.amount;
        if (transaction.channel === 'foodi') foodi += transaction.amount;
      }
      if (transaction.type === 'sale_adjustment') {
        if (transaction.method === 'cash') cash -= transaction.amount;
        if (transaction.method === 'bkash') bkash -= transaction.amount;
        if (transaction.method === 'bank') bank -= transaction.amount;
      }
      if (transaction.type === 'expense_product' || transaction.type === 'expense_fixed') {
        expenses += transaction.amount;
      }
    }

    const totalSales = Math.max(0, cash + bkash + bank);
    const profit = totalSales - expenses;

    return { cash, bkash, bank, inStore, foodpanda, foodi, expenses, totalSales, profit };
  }, [monthTransactions]);
  const insights = useInsights(period, stats);
  const monthLabel = useMemo(
    () =>
      new Date(selectedMonth.year, selectedMonth.month, 1).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      }),
    [selectedMonth]
  );
  const periodLabel = useMemo(() => ({ title: 'This Month', subtitle: monthLabel }), [monthLabel]);

  // Derived totals for percentage calculations
  const methodTotal = Math.max(1, period.cash + period.bkash + period.bank);
  const channelTotal = Math.max(1, period.inStore + period.foodpanda + period.foodi);
  const todayTotal = Math.max(1, today.cash + today.bkash + today.bank);

  const changeMonth = (offset: number) => {
    setSelectedMonth((prev) => {
      const next = new Date(prev.year, prev.month + offset, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const isCurrentMonth =
    selectedMonth.year === currentDate.getFullYear() &&
    selectedMonth.month === currentDate.getMonth();

  return (
    <div className="space-y-5">
      {/* ── Page header: title + live clock + date-range picker ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
            <CalendarDays size={13} />
            {formatDate(new Date())}
            <span className="mx-1 text-slate-300">·</span>
            <Clock size={13} />
            <LiveClock />
          </p>
        </div>
      </div>

      {/* ── Two-column 50/50 grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* ════════════════════════════════════
            LEFT — Today's Overview
        ════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {/* Card header */}
          <div className="px-5 py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white flex items-center justify-between shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="w-2 h-2 rounded-full bg-white/60 animate-pulse" />
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">
                  Today
                </p>
              </div>
              <h2 className="text-base font-bold">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </h2>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold text-emerald-200 uppercase tracking-wide">
                Total Sales
              </p>
              <p className="text-3xl font-black tabular-nums">৳{today.revenue.toLocaleString()}</p>
              <p className="text-[11px] text-emerald-200 mt-0.5">
                {today.orderCount} order{today.orderCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="p-5 space-y-5 flex-1">
            {/* Expenses + Cash drawer tiles */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-3.5">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown size={13} className="text-rose-600 shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-rose-500">
                    Expenses
                  </span>
                </div>
                <p className="text-xl font-black tabular-nums text-rose-700">
                  ৳{today.expenses.toLocaleString()}
                </p>
              </div>
              <div
                className={`rounded-xl p-3.5 border ${stats.cashBalance < 2_000 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Wallet
                    size={13}
                    className={stats.cashBalance < 2_000 ? 'text-red-600' : 'text-slate-600'}
                  />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Cash Drawer
                  </span>
                </div>
                <p
                  className={`text-xl font-black tabular-nums ${stats.cashBalance < 2_000 ? 'text-red-600' : 'text-slate-700'}`}
                >
                  ৳{stats.cashBalance.toLocaleString()}
                </p>
                {stats.cashBalance < 2_000 && (
                  <p className="text-[10px] text-red-500 font-semibold mt-0.5">⚠ Low balance</p>
                )}
              </div>
            </div>

            {/* Today's payment method breakdown */}
            <div className="space-y-3">
              <Divider label="Today by Payment Method" />
              {PAYMENT_METHODS.map((paymentMethod) => (
                <StatRow
                  key={paymentMethod.key}
                  icon={paymentMethod.icon}
                  iconBg={paymentMethod.iconBg}
                  iconColor={paymentMethod.iconColor}
                  label={paymentMethod.label}
                  value={today[paymentMethod.key]}
                  pct={(today[paymentMethod.key] / todayTotal) * 100}
                  barColor={paymentMethod.bar}
                />
              ))}
              {today.revenue > 0 && (
                <StackedBar
                  segments={PAYMENT_METHODS.map((paymentMethod) => ({
                    color: paymentMethod.bar,
                    pct: (today[paymentMethod.key] / todayTotal) * 100,
                  }))}
                />
              )}
            </div>

            {/* Top orders today by amount */}
            <div className="space-y-2">
              <Divider label="Top Orders Today" />
              {today.topOrders.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <ShoppingCart size={28} className="text-slate-200 mb-2" />
                  <p className="text-sm font-semibold text-slate-400">No orders yet today</p>
                </div>
              ) : (
                <div>
                  {today.topOrders.map((order, index) => (
                    <div
                      key={order.id}
                      className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0"
                    >
                      <span className="w-5 text-[10px] font-black text-slate-400 tabular-nums shrink-0">
                        #{index + 1}
                      </span>
                      <div
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          order.method === 'cash'
                            ? 'bg-emerald-400'
                            : order.method === 'bkash'
                              ? 'bg-pink-400'
                              : 'bg-blue-400'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">
                          {order.description}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {formatTime(new Date(order.date))}
                          {order.channel && (
                            <span className="ml-1.5 capitalize">
                              {order.channel.replace('_', '-')}
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-emerald-600 tabular-nums shrink-0">
                        ৳{order.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick sale form */}
            {canMutate && (
              <QuickSaleForm
                isOpen={showSaleForm}
                onToggle={() => setShowSaleForm((prev) => !prev)}
              />
            )}
          </div>
        </div>

        {/* ════════════════════════════════════
            RIGHT — Period Sales Overview
        ════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {/* Card header */}
          <div className="px-5 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between shrink-0">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Sales Overview
              </p>
              <h2 className="text-base font-bold mt-0.5">{periodLabel.title}</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">{periodLabel.subtitle}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <MonthNavigator
                label={monthLabel}
                onPrev={() => changeMonth(-1)}
                onNext={() => changeMonth(1)}
                disableNext={isCurrentMonth}
              />
              <div className="text-right">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                  Total Revenue
                </p>
                <p className="text-3xl font-black tabular-nums text-amber-400">
                  ৳{period.totalSales.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-6 flex-1">
            {/* Payment methods */}
            <div className="space-y-3">
              <Divider label="By Payment Method" />
              {PAYMENT_METHODS.map((paymentMethod) => (
                <StatRow
                  key={paymentMethod.key}
                  icon={paymentMethod.icon}
                  iconBg={paymentMethod.iconBg}
                  iconColor={paymentMethod.iconColor}
                  label={paymentMethod.label}
                  value={period[paymentMethod.key]}
                  pct={(period[paymentMethod.key] / methodTotal) * 100}
                  barColor={paymentMethod.bar}
                />
              ))}
              {period.totalSales > 0 && (
                <StackedBar
                  segments={PAYMENT_METHODS.map((paymentMethod) => ({
                    color: paymentMethod.bar,
                    pct: (period[paymentMethod.key] / methodTotal) * 100,
                  }))}
                />
              )}
            </div>

            {/* Sales channels */}
            <div className="space-y-3">
              <Divider label="By Sales Channel" />
              {SALES_CHANNELS.map((channel) => (
                <StatRow
                  key={channel.key}
                  icon={channel.icon}
                  iconBg={channel.iconBg}
                  iconColor={channel.iconColor}
                  label={channel.label}
                  value={period[channel.dataKey]}
                  pct={(period[channel.dataKey] / channelTotal) * 100}
                  barColor={channel.bar}
                />
              ))}
              {period.totalSales > 0 && (
                <StackedBar
                  segments={SALES_CHANNELS.map((channel) => ({
                    color: channel.bar,
                    pct: (period[channel.dataKey] / channelTotal) * 100,
                  }))}
                />
              )}
            </div>

            {/* Profit summary tiles */}
            <div>
              <Divider label="Profit Summary" />
              <div className="grid grid-cols-3 gap-3 mt-3">
                {[
                  {
                    label: 'Revenue',
                    value: period.totalSales,
                    icon: TrendingUp,
                    color: 'text-emerald-700',
                    bg: 'bg-emerald-50',
                  },
                  {
                    label: 'Expenses',
                    value: period.expenses,
                    icon: TrendingDown,
                    color: 'text-rose-600',
                    bg: 'bg-rose-50',
                  },
                  {
                    label: 'Net Profit',
                    value: period.profit,
                    icon: CircleDollarSign,
                    color: period.profit >= 0 ? 'text-amber-700' : 'text-rose-600',
                    bg: period.profit >= 0 ? 'bg-amber-50' : 'bg-rose-50',
                  },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                  <div key={label} className={`rounded-xl p-3.5 ${bg} text-center`}>
                    <Icon size={16} className={`${color} mx-auto mb-1.5`} />
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                      {label}
                    </p>
                    <p className={`text-base font-black tabular-nums ${color}`}>
                      {value < 0 ? '−' : ''}৳{Math.abs(value).toLocaleString()}
                    </p>
                    {label === 'Net Profit' && period.totalSales > 0 && (
                      <p className={`text-[10px] font-semibold mt-0.5 ${color} opacity-70`}>
                        {((period.profit / period.totalSales) * 100).toFixed(1)}% margin
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Total liquidity */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                <Wallet size={15} className="text-indigo-700" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Total Liquidity
                </p>
                <p className="text-lg font-black tabular-nums text-indigo-700">
                  ৳{stats.totalLiquidity.toLocaleString()}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Cash Drawer
                </p>
                <p className="text-sm font-bold text-slate-800 tabular-nums">
                  ৳{stats.cashBalance.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Smart Insights row ── */}
      {insights.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Zap size={13} className="text-amber-500" />
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
              Smart Insights
            </span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {insights.map((insight, index) => (
              <InsightCard key={index} insight={insight} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
