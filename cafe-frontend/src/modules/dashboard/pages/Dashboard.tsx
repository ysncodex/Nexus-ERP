/**
 * Dashboard — main overview page.
 *
 * Compact daily and monthly metrics with optional breakdowns and live balances.
 */
import { useState, useMemo, useEffect, useId, type ReactNode } from 'react';
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
  ChevronUp,
  AlertTriangle,
  AlertCircle,
  Target,
  Zap,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { useERP } from '@/core/context/useERP';
import { useERPActions } from '@/core/context/useERPActions';
import { ButtonLoading } from '@/shared/components/ui';
import { saleSchema, type SaleFormData, handleError } from '@/shared/utils';
import { businessDateKey, todayBusinessKey } from '@/shared/utils/businessDate';
import { useCanMutate } from '@/shared/hooks';
import { isLedgerExpense, type Transaction } from '@/core/types';
import type { FundMovement } from '@/core/types/fund.types';
// ─── Static config ────────────────────────────────────────────────────────────
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
function formatTime(date: Date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}
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
    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
      <button
        type="button"
        aria-label="Previous month"
        onClick={onPrev}
        className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
      >
        <ChevronLeft size={15} />
      </button>
      <span className="text-xs font-semibold text-slate-800 min-w-[110px] text-center select-none px-1">
        {label}
      </span>
      <button
        type="button"
        aria-label="Next month"
        onClick={onNext}
        disabled={disableNext}
        className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}
// ─── Small reusable components ────────────────────────────────────────────────
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
interface StatRowProps {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number;
  pct: number;
  barColor: string;
}
function StatRow({ icon: Icon, iconBg, iconColor, label, value, pct, barColor }: StatRowProps) {
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
const INSIGHT_STYLES = {
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
function BreakdownPanel({ title, children }: { title: string; children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          aria-label={`${isOpen ? 'Hide' : 'View'} breakdown: ${title}`}
          onClick={() => setIsOpen((value) => !value)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          {isOpen ? 'Hide breakdown' : 'View breakdown'}
          <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>
      <div id={panelId} hidden={!isOpen} className="border-t border-slate-100 p-4">
        {children}
      </div>
    </section>
  );
}

// ─── Interactive Expandable Components ────────────────────────────────────────
function ExpandableRevenueCard({
  revenue,
  orderCount,
  cash,
  bkash,
  bank,
  total,
}: {
  revenue: number;
  orderCount: number;
  cash: number;
  bkash: number;
  bank: number;
  total: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const cashPct = total > 0 ? Math.round((cash / total) * 100) : 0;
  const bkashPct = total > 0 ? Math.round((bkash / total) * 100) : 0;
  const bankPct = total > 0 ? Math.round((bank / total) * 100) : 0;
  const panelId = useId();
  return (
    <div className="min-w-0 rounded-xl border border-emerald-100 bg-white">
      <div className="p-4">
        <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <TrendingUp size={15} className="text-emerald-600" /> Today's revenue
        </p>
        <p className="mt-2 break-words text-2xl font-bold tabular-nums text-slate-900">
          ৳{revenue.toLocaleString()}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-500">{orderCount} orders</span>
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={panelId}
            aria-label={`${isExpanded ? 'Hide' : 'View'} breakdown: today's revenue`}
            onClick={() => setIsExpanded((value) => !value)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            {isExpanded ? 'Hide breakdown' : 'View breakdown'}
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>
      {isExpanded && (
        <div id={panelId} className="px-4 pb-4">
          <div className="border-t border-slate-100 pt-4">
            <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-3.5">
              By Payment Method
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-[13px] font-medium text-slate-700">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Cash
                </div>
                <div className="flex items-center gap-3 text-[13px]">
                  <span className="font-bold text-emerald-600">{cash.toLocaleString()} ৳</span>
                  <span className="text-slate-400 text-[11px] w-8 text-right font-medium">
                    {cashPct}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-[13px] font-medium text-slate-700">
                  <div className="w-2.5 h-2.5 rounded-full bg-pink-500" /> bKash
                </div>
                <div className="flex items-center gap-3 text-[13px]">
                  <span className="font-bold text-pink-600">{bkash.toLocaleString()} ৳</span>
                  <span className="text-slate-400 text-[11px] w-8 text-right font-medium">
                    {bkashPct}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-[13px] font-medium text-slate-700">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Card / Bank
                </div>
                <div className="flex items-center gap-3 text-[13px]">
                  <span className="font-bold text-blue-600">{bank.toLocaleString()} ৳</span>
                  <span className="text-slate-400 text-[11px] w-8 text-right font-medium">
                    {bankPct}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
interface ExpandableAccountCardProps {
  accountKey: 'cash' | 'bkash' | 'bank' | 'reserve' | 'total';
  title: string;
  icon: LucideIcon;
  balance: number;
  transactions: Transaction[];
  fundMovements: FundMovement[];
  monthStart: Date;
  monthEnd: Date;
  isDark?: boolean;
  colorMap: {
    bg: string;
    border: string;
    hoverBorder: string;
    expandedBorder: string;
    iconBg: string;
    iconText: string;
    titleText: string;
    balanceText: string;
  };
}
function ExpandableAccountCard({
  accountKey,
  title,
  icon: Icon,
  balance,
  transactions,
  fundMovements,
  monthStart,
  monthEnd,
  colorMap,
  isDark = false,
}: ExpandableAccountCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const panelId = useId();
  const breakdown = useMemo(() => {
    let opening = 0,
      monthSales = 0,
      monthExpenses = 0,
      monthFundsIn = 0,
      monthFundsOut = 0;
    const accounts = accountKey === 'total' ? ['cash', 'bkash', 'bank', 'reserve'] : [accountKey];
    transactions.forEach((t: Transaction) => {
      if (!t.date || !t.method || !accounts.includes(t.method)) return;
      const isBeforeMonth = t.date < monthStart;
      const isThisMonth = t.date >= monthStart && t.date <= monthEnd;
      const amt = Number(t.amount);
      if (t.type === 'sale') {
        if (isBeforeMonth) opening += amt;
        if (isThisMonth) monthSales += amt;
      } else if (t.type === 'sale_adjustment') {
        if (isBeforeMonth) opening -= amt;
        if (isThisMonth) monthSales -= amt;
      } else if (isLedgerExpense(t.type)) {
        if (isBeforeMonth) opening -= amt;
        if (isThisMonth) monthExpenses += amt;
      }
    });
    fundMovements.forEach((m: FundMovement) => {
      const date = new Date(m.date);
      const isBeforeMonth = date < monthStart;
      const isThisMonth = date >= monthStart && date <= monthEnd;
      const amt = Number(m.amount);
      const isOpening = m.movementType === 'opening';
      if (m.toAccount && accounts.includes(m.toAccount)) {
        if (isBeforeMonth || isOpening) opening += amt;
        else if (isThisMonth) monthFundsIn += amt;
      }
      if (m.fromAccount && accounts.includes(m.fromAccount)) {
        if (isBeforeMonth || isOpening) opening -= amt;
        else if (isThisMonth) monthFundsOut += amt;
      }
    });
    return { opening, monthSales, monthExpenses, monthFundsIn, monthFundsOut };
  }, [accountKey, monthStart, monthEnd, transactions, fundMovements]);
  const salesColor = isDark ? 'text-emerald-400' : 'text-emerald-600';
  const expenseColor = isDark ? 'text-rose-400' : 'text-rose-600';
  const fundsInColor = isDark ? 'text-sky-400' : 'text-indigo-600';
  const fundsOutColor = isDark ? 'text-orange-400' : 'text-orange-600';
  return (
    <div
      className={`rounded-xl border transition-all duration-300 min-w-0 overflow-hidden relative group h-fit
        ${isExpanded ? `shadow-md ${colorMap.expandedBorder}` : `shadow-sm ${colorMap.border}`}
        ${colorMap.bg}
      `}
    >
      {isDark && (
        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-amber-500/20 rounded-full blur-2xl transition-all duration-500 z-0 pointer-events-none group-hover:bg-amber-500/30"></div>
      )}
      <div className="p-4 relative z-10">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-md flex items-center justify-center shadow-sm ${colorMap.iconBg} ${colorMap.iconText}`}
            >
              <Icon size={14} />
            </div>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider ${colorMap.titleText}`}
            >
              {title}
            </span>
          </div>
        </div>
        <p
          className={`break-words text-xl font-bold tabular-nums tracking-tight ${colorMap.balanceText}`}
        >
          ৳{balance.toLocaleString()}
        </p>
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={panelId}
          aria-label={`${isExpanded ? 'Hide' : 'View'} breakdown: ${title}`}
          onClick={() => setIsExpanded((value) => !value)}
          className={`mt-2 inline-flex items-center gap-1 rounded-lg py-1.5 text-xs font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${colorMap.titleText}`}
        >
          {isExpanded ? 'Hide breakdown' : 'View breakdown'}
          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {isExpanded && (
          <div
            id={panelId}
            className={`mt-4 pt-3 border-t animate-in slide-in-from-top-2 fade-in duration-200 ${isDark ? 'border-white/10 text-white/80' : 'border-slate-200 text-slate-600'}`}
          >
            <p className="mb-3 text-[11px] font-semibold">
              {monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} movements
            </p>
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between items-center">
                <span>Opening</span>
                <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  ৳{breakdown.opening.toLocaleString()}
                </span>
              </div>
              {accountKey !== 'reserve' && (
                <>
                  <div className="flex justify-between items-center">
                    <span className={`font-medium ${salesColor}`}>Sales (+)</span>
                    <span className={`font-bold ${salesColor}`}>
                      ৳{breakdown.monthSales.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`font-medium ${expenseColor}`}>Expenses (−)</span>
                    <span className={`font-bold ${expenseColor}`}>
                      ৳{breakdown.monthExpenses.toLocaleString()}
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center">
                <span className={`font-medium ${fundsInColor}`}>Funds In (+)</span>
                <span className={`font-bold ${fundsInColor}`}>
                  ৳{breakdown.monthFundsIn.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className={`font-medium ${fundsOutColor}`}>Funds Out (−)</span>
                <span className={`font-bold ${fundsOutColor}`}>
                  ৳{breakdown.monthFundsOut.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
// ─── Sub-panels ───────────────────────────────────────────────────────────────
function QuickSaleForm({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  const { addTransaction } = useERPActions();
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
      onToggle();
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
    `w-full px-3 py-2 rounded-xl border text-sm outline-none transition-all ${hasError ? 'border-red-300 focus:ring-2 focus:ring-red-100' : 'border-slate-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100'}`;
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden h-fit">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <PlusCircle size={15} className="text-emerald-600" /> Quick Record Sale
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
          <div className="grid grid-cols-2 gap-2">
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
                    className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl border text-[10px] font-bold transition-all ${selectedChannel === value ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                  >
                    <Icon size={11} /> {label}
                  </button>
                ))}
              </div>
            </div>
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
                    className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl border text-[10px] font-bold transition-all ${selectedPaymentMethod === value ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                  >
                    <Icon size={11} /> {label}
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
// ─── Missing Hooks Restored ───────────────────────────────────────────────────
function useTodayStats(transactions: Transaction[]) {
  return useMemo(() => {
    const todayKey = todayBusinessKey();
    let revenue = 0,
      orderCount = 0,
      expenses = 0;
    let cash = 0,
      bkash = 0,
      bank = 0;
    const todaySales: Transaction[] = [];
    for (const transaction of transactions) {
      if (!transaction.date) continue;
      if (businessDateKey(transaction.date) !== todayKey) continue;
      if (transaction.type === 'sale') {
        revenue += Number(transaction.amount);
        orderCount++;
        todaySales.push(transaction);
        if (transaction.method === 'cash') cash += Number(transaction.amount);
        if (transaction.method === 'bkash') bkash += Number(transaction.amount);
        if (transaction.method === 'bank') bank += Number(transaction.amount);
      }
      if (transaction.type === 'sale_adjustment') {
        revenue -= Number(transaction.amount);
        if (transaction.method === 'cash') cash -= Number(transaction.amount);
        if (transaction.method === 'bkash') bkash -= Number(transaction.amount);
        if (transaction.method === 'bank') bank -= Number(transaction.amount);
      }
      if (isLedgerExpense(transaction.type)) {
        expenses += Number(transaction.amount);
      }
    }
    const topOrders = [...todaySales]
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 3);
    return { revenue, orderCount, expenses, cash, bkash, bank, topOrders };
  }, [transactions]);
}
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
  stats: ReturnType<typeof useERP>['stats'],
  costCompletenessNotice: string | undefined
): InsightItem[] {
  return useMemo(() => {
    const insightList: InsightItem[] = [];
    const profitMargin = period.totalSales > 0 ? (period.profit / period.totalSales) * 100 : 0;
    const expenseRatio = period.totalSales > 0 ? (period.expenses / period.totalSales) * 100 : 0;
    if (stats.cashBalance < 2_000)
      insightList.push({
        type: 'danger',
        icon: AlertTriangle,
        title: 'Low Cash Drawer',
        desc: `Only ৳${stats.cashBalance.toLocaleString()} in cash. Add cash from Cash & Accounts.`,
      });
    else if (stats.cashBalance > 30_000)
      insightList.push({
        type: 'warning',
        icon: AlertCircle,
        title: 'Excess Cash',
        desc: `৳${stats.cashBalance.toLocaleString()} in drawer — consider moving to reserve.`,
      });
    if (profitMargin > 20 && !costCompletenessNotice)
      insightList.push({
        type: 'info',
        icon: AlertCircle,
        title: 'Recorded Profit Margin',
        desc: `${profitMargin.toFixed(1)}% based on recorded expenses. Verify all costs before assessing performance.`,
      });
    else if (expenseRatio > 80 && period.totalSales > 0)
      insightList.push({
        type: 'danger',
        icon: AlertTriangle,
        title: 'High Expense Ratio',
        desc: `Expenses are ${expenseRatio.toFixed(0)}% of revenue — margins under pressure.`,
      });
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
  }, [period, stats, costCompletenessNotice]);
}
// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { transactions, stats, fundMovements } = useERP();
  const canMutate = useCanMutate();
  const [showSaleForm, setShowSaleForm] = useState(false);
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<SelectedMonth>({
    year: currentDate.getFullYear(),
    month: currentDate.getMonth(),
  });
  const monthStart = useMemo(
    () => new Date(selectedMonth.year, selectedMonth.month, 1),
    [selectedMonth]
  );
  const monthEnd = useMemo(
    () => new Date(selectedMonth.year, selectedMonth.month + 1, 0, 23, 59, 59, 999),
    [selectedMonth]
  );
  const today = useTodayStats(transactions);
  const monthTransactions = useMemo(
    () => transactions.filter((t) => t.date && t.date >= monthStart && t.date <= monthEnd),
    [monthStart, monthEnd, transactions]
  );
  const period = useMemo(() => {
    let cash = 0,
      bkash = 0,
      bank = 0,
      inStore = 0,
      foodpanda = 0,
      foodi = 0,
      expenses = 0;
    for (const t of monthTransactions) {
      if (t.type === 'sale') {
        if (t.method === 'cash') cash += Number(t.amount);
        if (t.method === 'bkash') bkash += Number(t.amount);
        if (t.method === 'bank') bank += Number(t.amount);
        if (t.channel === 'in_store') inStore += Number(t.amount);
        if (t.channel === 'foodpanda') foodpanda += Number(t.amount);
        if (t.channel === 'foodi') foodi += Number(t.amount);
      }
      if (t.type === 'sale_adjustment') {
        if (t.method === 'cash') cash -= Number(t.amount);
        if (t.method === 'bkash') bkash -= Number(t.amount);
        if (t.method === 'bank') bank -= Number(t.amount);
      }
      if (isLedgerExpense(t.type)) expenses += Number(t.amount);
    }
    const totalSales = Math.max(0, cash + bkash + bank);
    return {
      cash,
      bkash,
      bank,
      inStore,
      foodpanda,
      foodi,
      expenses,
      totalSales,
      profit: totalSales - expenses,
    };
  }, [monthTransactions]);
  const recordedProductCosts = monthTransactions
    .filter((transaction) => transaction.type === 'expense_product')
    .reduce((total, transaction) => total + Number(transaction.amount), 0);
  const costCompletenessNotice =
    period.totalSales > 0 && recordedProductCosts <= 0
      ? 'No purchases recorded for this period. Profit and margins use recorded expenses only and may be overstated. Record or verify purchases before assessing performance.'
      : undefined;
  const insights = useInsights(period, stats, costCompletenessNotice);
  const monthLabel = useMemo(
    () => monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    [monthStart]
  );
  const methodTotal = Math.max(1, period.cash + period.bkash + period.bank);
  const channelTotal = Math.max(1, period.inStore + period.foodpanda + period.foodi);
  const todayTotal = Math.max(1, today.cash + today.bkash + today.bank);
  const changeMonth = (offset: number) =>
    setSelectedMonth((p) => {
      const n = new Date(p.year, p.month + offset, 1);
      return { year: n.getFullYear(), month: n.getMonth() };
    });
  const isCurrentMonth =
    selectedMonth.year === currentDate.getFullYear() &&
    selectedMonth.month === currentDate.getMonth();
  return (
    <div className="min-w-0 space-y-4 pb-6">
      {/* The app shell already supplies the Dashboard heading. */}
      <section aria-label="Today's activity" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-800">Today's activity</h2>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <span className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <CalendarDays size={13} /> {formatDate(new Date())}
            <span className="mx-1 text-slate-300">·</span>
            <Clock size={13} />
            <LiveClock />
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 items-start">
          <ExpandableRevenueCard
            revenue={today.revenue}
            orderCount={today.orderCount}
            cash={today.cash}
            bkash={today.bkash}
            bank={today.bank}
            total={todayTotal}
          />
          <div className="min-w-0 rounded-xl border border-rose-100 bg-white p-4">
            <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <TrendingDown size={15} className="text-rose-600" /> Today's expenses
            </p>
            <p className="mt-2 break-words text-2xl font-bold tabular-nums text-rose-700">
              ৳{today.expenses.toLocaleString()}
            </p>
            <p className="mt-3 text-xs text-slate-500">Fixed expenses and purchases</p>
          </div>
          <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
            <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Wallet size={15} /> Cash drawer
            </p>
            <p
              className={`mt-2 break-words text-2xl font-bold tabular-nums ${stats.cashBalance < 2_000 ? 'text-rose-600' : 'text-slate-800'}`}
            >
              ৳{stats.cashBalance.toLocaleString()}
            </p>
            <p
              className={`mt-3 text-xs ${stats.cashBalance < 2_000 ? 'font-semibold text-rose-600' : 'text-slate-500'}`}
            >
              {stats.cashBalance < 2_000 ? 'Low balance' : 'Live account balance'}
            </p>
          </div>
        </div>
      </section>
      <section
        aria-label="Monthly sales overview"
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">
              {isCurrentMonth ? 'This month' : 'Monthly overview'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">{monthLabel}</p>
          </div>
          <MonthNavigator
            label={monthLabel}
            onPrev={() => changeMonth(-1)}
            onNext={() => changeMonth(1)}
            disableNext={isCurrentMonth}
          />
        </div>
        {costCompletenessNotice && (
          <div
            role="note"
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            <p className="font-semibold">Cost completeness: review required</p>
            <p className="mt-1 leading-relaxed">{costCompletenessNotice}</p>
          </div>
        )}
        <div className="grid grid-cols-1 min-[480px]:grid-cols-3 gap-3">
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
            <div key={label} className={`rounded-xl p-3.5 ${bg} min-w-0`}>
              <Icon size={16} className={`${color} mb-1.5`} />
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                {label}
              </p>
              <p className={`break-words text-xl font-bold tabular-nums ${color}`}>
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
        <BreakdownPanel title="Payments and sales channels">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <Divider label="By Payment Method" />
              {PAYMENT_METHODS.map((method) => (
                <StatRow
                  key={method.key}
                  icon={method.icon}
                  iconBg={method.iconBg}
                  iconColor={method.iconColor}
                  label={method.label}
                  value={period[method.key]}
                  pct={(period[method.key] / methodTotal) * 100}
                  barColor={method.bar}
                />
              ))}
              {period.totalSales > 0 && (
                <StackedBar
                  segments={PAYMENT_METHODS.map((m) => ({
                    color: m.bar,
                    pct: (period[m.key] / methodTotal) * 100,
                  }))}
                />
              )}
            </div>
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
                  segments={SALES_CHANNELS.map((c) => ({
                    color: c.bar,
                    pct: (period[c.dataKey] / channelTotal) * 100,
                  }))}
                />
              )}
            </div>
          </div>
        </BreakdownPanel>
      </section>
      {/* ── HORIZONTAL LIVE ACCOUNT BALANCES STRIP WITH INLINE EXPANDERS ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-slate-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
              Live Account Balances
            </h2>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-md hidden sm:inline-block">
            Live balances · selected-month breakdowns
          </span>
        </div>
        <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 items-start">
          <ExpandableAccountCard
            accountKey="cash"
            title="Cash Drawer"
            icon={Banknote}
            balance={stats.cashBalance ?? 0}
            transactions={transactions}
            fundMovements={fundMovements}
            monthStart={monthStart}
            monthEnd={monthEnd}
            colorMap={{
              bg: 'bg-emerald-50',
              border: 'border-emerald-100',
              hoverBorder: 'border-emerald-300',
              expandedBorder: 'border-emerald-200 ring-1 ring-emerald-50',
              iconBg: 'bg-white',
              iconText: 'text-emerald-600',
              titleText: 'text-emerald-800',
              balanceText: 'text-emerald-700',
            }}
          />
          <ExpandableAccountCard
            accountKey="bkash"
            title="bKash Wallet"
            icon={Smartphone}
            balance={stats.bkashBalance ?? 0}
            transactions={transactions}
            fundMovements={fundMovements}
            monthStart={monthStart}
            monthEnd={monthEnd}
            colorMap={{
              bg: 'bg-pink-50',
              border: 'border-pink-100',
              hoverBorder: 'border-pink-300',
              expandedBorder: 'border-pink-200 ring-1 ring-pink-50',
              iconBg: 'bg-white',
              iconText: 'text-pink-600',
              titleText: 'text-pink-800',
              balanceText: 'text-pink-700',
            }}
          />
          <ExpandableAccountCard
            accountKey="bank"
            title="Bank / Card"
            icon={Landmark}
            balance={stats.bankBalance ?? 0}
            transactions={transactions}
            fundMovements={fundMovements}
            monthStart={monthStart}
            monthEnd={monthEnd}
            colorMap={{
              bg: 'bg-blue-50',
              border: 'border-blue-100',
              hoverBorder: 'border-blue-300',
              expandedBorder: 'border-blue-200 ring-1 ring-blue-50',
              iconBg: 'bg-white',
              iconText: 'text-blue-600',
              titleText: 'text-blue-800',
              balanceText: 'text-blue-700',
            }}
          />
          <ExpandableAccountCard
            accountKey="reserve"
            title="Reserve Fund"
            icon={ShieldCheck}
            balance={stats.reserveBalance ?? 0}
            transactions={transactions}
            fundMovements={fundMovements}
            monthStart={monthStart}
            monthEnd={monthEnd}
            colorMap={{
              bg: 'bg-purple-50',
              border: 'border-purple-100',
              hoverBorder: 'border-purple-300',
              expandedBorder: 'border-purple-200 ring-1 ring-purple-50',
              iconBg: 'bg-white',
              iconText: 'text-purple-600',
              titleText: 'text-purple-800',
              balanceText: 'text-purple-700',
            }}
          />
          {/* Special Dark Master Card for Total Liquidity */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-1">
            <ExpandableAccountCard
              accountKey="total"
              title="Total Liquid Assets"
              icon={Zap}
              balance={stats.totalLiquidity ?? 0}
              transactions={transactions}
              fundMovements={fundMovements}
              monthStart={monthStart}
              monthEnd={monthEnd}
              isDark={true}
              colorMap={{
                bg: 'bg-gradient-to-br from-slate-900 to-slate-800',
                border: 'border-slate-700',
                hoverBorder: 'border-slate-600',
                expandedBorder: 'border-slate-500 ring-1 ring-slate-800',
                iconBg: 'bg-white/10 border border-white/5 backdrop-blur-sm',
                iconText: 'text-amber-400',
                titleText: 'text-slate-300',
                balanceText: 'text-white',
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        <BreakdownPanel title="Top orders today">
          {today.topOrders.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <ShoppingCart size={28} className="text-slate-200 mb-2" />
              <p className="text-sm font-semibold text-slate-400">No orders yet today</p>
            </div>
          ) : (
            <div>
              {today.topOrders.map((order: Transaction, index: number) => (
                <div
                  key={order.id}
                  className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0"
                >
                  <span className="w-5 text-[10px] font-black text-slate-400 tabular-nums shrink-0">
                    #{index + 1}
                  </span>
                  <div
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${order.method === 'cash' ? 'bg-emerald-400' : order.method === 'bkash' ? 'bg-pink-400' : 'bg-blue-400'}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">
                      {order.description}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {order.date ? formatTime(new Date(order.date)) : ''}
                      {order.channel && (
                        <span className="ml-1.5 capitalize">{order.channel.replace('_', '-')}</span>
                      )}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-emerald-600 tabular-nums shrink-0">
                    ৳{Number(order.amount).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </BreakdownPanel>
        {canMutate && (
          <QuickSaleForm
            isOpen={showSaleForm}
            onToggle={() => setShowSaleForm((value) => !value)}
          />
        )}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {insights.map((insight: InsightItem, index: number) => (
              <InsightCard key={index} insight={insight} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
