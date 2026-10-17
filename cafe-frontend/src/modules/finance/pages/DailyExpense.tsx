import { useMemo, useCallback, useState } from 'react';
import {
  Pencil,
  Trash2,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Banknote,
  Smartphone,
  Landmark,
  Tag,
  Layers,
  Boxes,
  Search,
  CalendarDays,
  Activity,
  X,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { useERP } from '@/core/context/useERP';
import { ManagerPasswordModal, EditTransactionModal, Pagination } from '@/shared/components/ui';
import { useClientPagination, useCanMutate } from '@/shared/hooks';
import type { Transaction } from '@/core/types';
import { handleError } from '@/shared/utils';
import { ExportDropdown, TRANSACTION_EXPORT_COLUMNS } from '@/shared/export';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABLE_COLUMNS = ['Date', 'Type', 'Details', 'Supplier', 'Via', 'Cost', 'Actions'] as const;
type TableColumn = (typeof TABLE_COLUMNS)[number];
const RIGHT_ALIGNED_COLUMNS = new Set<TableColumn>(['Cost', 'Actions']);

const EXPENSE_TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  expense_product: {
    label: 'Purchases',
    className: 'bg-orange-50 text-orange-700 border border-orange-200',
  },
  expense_consumable: {
    label: 'Consumables & Packaging',
    className: 'bg-teal-50 text-teal-700 border border-teal-200',
  },
};
const DEFAULT_TYPE_CONFIG = {
  label: 'Fixed expenses',
  className: 'bg-purple-50 text-purple-700 border border-purple-200',
};

const METHOD_CONFIG: Record<
  string,
  { label: string; icon: LucideIcon; color: string; bg: string; border: string }
> = {
  cash: {
    label: 'Cash',
    icon: Banknote,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
  },
  bank: {
    label: 'Bank',
    icon: Landmark,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
  },
  bkash: {
    label: 'bKash',
    icon: Smartphone,
    color: 'text-pink-600',
    bg: 'bg-pink-50',
    border: 'border-pink-100',
  },
};

/** Chart buckets use the same colours as the type badges in the table. */
type ExpenseBucket = 'fixed' | 'purchases' | 'consumables';
const BUCKETS: { key: ExpenseBucket; label: string; color: string; dot: string }[] = [
  { key: 'fixed', label: 'Fixed expenses', color: '#a855f7', dot: 'bg-purple-500' },
  { key: 'purchases', label: 'Purchases', color: '#f97316', dot: 'bg-orange-500' },
  { key: 'consumables', label: 'Consumables', color: '#14b8a6', dot: 'bg-teal-500' },
];
const bucketOf = (type: string): ExpenseBucket =>
  type === 'expense_product'
    ? 'purchases'
    : type === 'expense_consumable'
      ? 'consumables'
      : 'fixed';

const fmtTk = (n: number) => `${n.toLocaleString()} ৳`;
const fmtAxis = (v: number) => (v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(v));

// ─── Types ────────────────────────────────────────────────────────────────────

interface SelectedMonth {
  year: number;
  month: number; // 0-indexed
}

interface PasswordModalState {
  isOpen: boolean;
  title: string;
  action: (() => void) | null;
  requiredRole: 'owner' | 'manager';
}

interface EditModalState {
  isOpen: boolean;
  transaction: Transaction | null;
}

interface DayPoint {
  day: number;
  dateLabel: string;
  fixed: number;
  purchases: number;
  consumables: number;
  total: number;
  count: number;
  isFuture: boolean;
  cumulative: number | null;
  prevCumulative: number | null;
}

type TypeFilterValue = 'all' | 'fixed' | 'variable' | 'consumable';
type MethodFilterValue = 'all' | 'cash' | 'bank' | 'bkash';
type ChartView = 'daily' | 'cumulative';

const CLOSED_PASSWORD_MODAL: PasswordModalState = {
  isOpen: false,
  title: '',
  action: null,
  requiredRole: 'owner',
};
const CLOSED_EDIT_MODAL: EditModalState = { isOpen: false, transaction: null };

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <tr>
      <td colSpan={TABLE_COLUMNS.length} className="px-4 py-16 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="p-4 bg-slate-50 rounded-2xl">
            <AlertCircle size={28} className="text-slate-300" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500">No expenses found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[200px] mx-auto leading-relaxed">
              {hasFilters
                ? 'Try adjusting your filters or search query'
                : 'No expenses recorded for this period'}
            </p>
          </div>
        </div>
      </td>
    </tr>
  );
}

interface MonthNavigatorProps {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  disableNext: boolean;
}

function MonthNavigator({ label, onPrev, onNext, disableNext }: MonthNavigatorProps) {
  const navigationButtonClass =
    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-30';

  return (
    <div
      role="group"
      aria-label="Expense history month"
      className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
    >
      <button
        type="button"
        onClick={onPrev}
        aria-label="Previous month"
        title="Previous month"
        className={navigationButtonClass}
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      <span
        className="inline-flex min-w-[150px] items-center justify-center gap-2 px-2 text-xs font-semibold text-slate-800 sm:text-sm"
        aria-live="polite"
        aria-atomic="true"
      >
        <CalendarDays size={15} className="shrink-0 text-slate-400" aria-hidden="true" />
        <span className="whitespace-nowrap">{label}</span>
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={disableNext}
        aria-label="Next month"
        title="Next month"
        className={navigationButtonClass}
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

interface DailyExpenseTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: DayPoint }>;
  view: ChartView;
  avg: number;
  prevLabel: string;
}

function DailyExpenseTooltip({ active, payload, view, avg, prevLabel }: DailyExpenseTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d || d.isFuture) return null;

  const vsAvg = avg > 0 && d.total > 0 ? Math.round(((d.total - avg) / avg) * 100) : null;

  return (
    <div className="min-w-[170px] rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl">
      <p className="mb-2 font-semibold text-slate-500">{d.dateLabel}</p>

      {view === 'cumulative' ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">Running total</span>
            <span className="font-extrabold tabular-nums text-rose-600">
              {fmtTk(d.cumulative ?? 0)}
            </span>
          </div>
          {d.prevCumulative !== null && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">{prevLabel} same day</span>
              <span className="font-semibold tabular-nums text-slate-600">
                {fmtTk(d.prevCumulative)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-1">
            <span className="text-slate-500">This day</span>
            <span className="font-semibold tabular-nums text-slate-700">{fmtTk(d.total)}</span>
          </div>
        </div>
      ) : d.total === 0 ? (
        <p className="text-slate-400">No expenses recorded</p>
      ) : (
        <div className="space-y-1">
          {BUCKETS.filter((b) => d[b.key] > 0).map((b) => (
            <div key={b.key} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className={`h-2 w-2 rounded-full ${b.dot}`} />
                {b.label}
              </span>
              <span className="font-semibold tabular-nums text-slate-700">{fmtTk(d[b.key])}</span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-1">
            <span className="font-semibold text-slate-600">Total</span>
            <span className="text-sm font-extrabold tabular-nums text-rose-600">
              {fmtTk(d.total)}
            </span>
          </div>
          <p className="pt-0.5 text-[10px] text-slate-400">
            {d.count} transaction{d.count !== 1 ? 's' : ''}
            {vsAvg !== null && ` · ${vsAvg >= 0 ? '+' : ''}${vsAvg}% vs average day`}
          </p>
        </div>
      )}
    </div>
  );
}

interface MiniStatProps {
  label: string;
  value: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  valueColor?: string;
}

function MiniStat({
  label,
  value,
  icon: Icon,
  iconColor,
  iconBg,
  valueColor = 'text-slate-800',
}: MiniStatProps) {
  return (
    <div className="flex items-center gap-2.5 sm:gap-3 p-3 sm:p-3.5 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl shrink-0 ${iconBg}`}>
        <Icon size={16} strokeWidth={2.5} className={iconColor} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1 truncate">
          {label}
        </p>
        <p
          className={`text-sm sm:text-base font-extrabold tabular-nums tracking-tight leading-none truncate ${valueColor}`}
          title={value}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

/** Small read-out above the chart, so the key numbers don't need to be read off bars. */
function ChartChip({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'text-slate-800',
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
      <Icon size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500">{label}</p>
        <p className={`truncate text-sm font-bold tabular-nums ${tone}`} title={value}>
          {value}
        </p>
        {sub && <p className="truncate text-[11px] text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const now = new Date();

export default function DailyExpense() {
  const canMutate = useCanMutate();
  const { transactions, deleteTransaction, updateTransaction, itemNames, suppliers } = useERP();

  // ── Month selection ──────────────────────────────────────────────────────
  const [selectedMonth, setSelectedMonth] = useState<SelectedMonth>({
    year: now.getFullYear(),
    month: now.getMonth(),
  });

  const isCurrentMonth =
    selectedMonth.year === now.getFullYear() && selectedMonth.month === now.getMonth();

  const monthLabel = useMemo(
    () =>
      new Date(selectedMonth.year, selectedMonth.month, 1).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      }),
    [selectedMonth]
  );

  // ── Filters ──────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilterValue>('all');
  const [methodFilter, setMethodFilter] = useState<MethodFilterValue>('all');
  const [dayFilter, setDayFilter] = useState<number | null>(null);
  const [chartView, setChartView] = useState<ChartView>('daily');

  const goToPrevMonth = useCallback(() => {
    setDayFilter(null);
    setSelectedMonth((prev) =>
      prev.month === 0
        ? { year: prev.year - 1, month: 11 }
        : { year: prev.year, month: prev.month - 1 }
    );
  }, []);

  const goToNextMonth = useCallback(() => {
    setDayFilter(null);
    setSelectedMonth((prev) =>
      prev.month === 11
        ? { year: prev.year + 1, month: 0 }
        : { year: prev.year, month: prev.month + 1 }
    );
  }, []);

  const toggleDay = useCallback(
    (day: number) => setDayFilter((current) => (current === day ? null : day)),
    []
  );

  // ── Derived data ─────────────────────────────────────────────────────────
  // Filter from all transactions (not filteredTransactions) so month navigation
  // is independent of any global date-range filter applied elsewhere in the app.
  const expenseTransactions = useMemo(
    () =>
      transactions.filter(
        (t) =>
          t.type.includes('expense') &&
          t.date instanceof Date &&
          t.date.getFullYear() === selectedMonth.year &&
          t.date.getMonth() === selectedMonth.month
      ),
    [transactions, selectedMonth]
  );

  const monthlyTotal = useMemo(
    () => expenseTransactions.reduce((sum, t) => sum + t.amount, 0),
    [expenseTransactions]
  );

  const fixedTotal = useMemo(
    () =>
      expenseTransactions
        .filter((t) => t.type === 'expense_fixed')
        .reduce((s, t) => s + t.amount, 0),
    [expenseTransactions]
  );

  const variableTotal = useMemo(
    () =>
      expenseTransactions
        .filter((t) => t.type === 'expense_product')
        .reduce((s, t) => s + t.amount, 0),
    [expenseTransactions]
  );

  const consumableTotal = useMemo(
    () =>
      expenseTransactions
        .filter((t) => t.type === 'expense_consumable')
        .reduce((s, t) => s + t.amount, 0),
    [expenseTransactions]
  );

  const activeDays = useMemo(
    () => new Set(expenseTransactions.map((t) => t.date.getDate())).size,
    [expenseTransactions]
  );
  const avgDailyExpense = activeDays > 0 ? Math.round(monthlyTotal / activeDays) : 0;

  const methodBreakdown = useMemo(() => {
    const b = { cash: 0, bank: 0, bkash: 0 };
    expenseTransactions.forEach((t) => {
      const method = t.method ?? 'cash';
      if (method in b) b[method as keyof typeof b] += t.amount;
    });
    return b;
  }, [expenseTransactions]);

  const topSuppliers = useMemo(() => {
    const map = new Map<string, number>();
    expenseTransactions.forEach((t) => {
      if (t.supplier) map.set(t.supplier, (map.get(t.supplier) ?? 0) + t.amount);
    });
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, total]) => ({ name, total }));
  }, [expenseTransactions]);

  /** Previous month, used for the same-period pace comparison. */
  const prevMonth = useMemo(() => {
    const year = selectedMonth.month === 0 ? selectedMonth.year - 1 : selectedMonth.year;
    const month = selectedMonth.month === 0 ? 11 : selectedMonth.month - 1;
    const byDay = new Map<number, number>();
    let total = 0;
    for (const t of transactions) {
      if (
        t.type.includes('expense') &&
        t.date instanceof Date &&
        t.date.getFullYear() === year &&
        t.date.getMonth() === month
      ) {
        byDay.set(t.date.getDate(), (byDay.get(t.date.getDate()) ?? 0) + t.amount);
        total += t.amount;
      }
    }
    return {
      byDay,
      total,
      label: new Date(year, month, 1).toLocaleDateString('en-US', { month: 'short' }),
    };
  }, [transactions, selectedMonth]);

  const daysInMonth = new Date(selectedMonth.year, selectedMonth.month + 1, 0).getDate();
  const elapsedDays = isCurrentMonth ? now.getDate() : daysInMonth;

  const dailyChartData = useMemo<DayPoint[]>(() => {
    const byDay = new Map<
      number,
      { fixed: number; purchases: number; consumables: number; count: number }
    >();
    for (const t of expenseTransactions) {
      const day = t.date.getDate();
      const entry = byDay.get(day) ?? { fixed: 0, purchases: 0, consumables: 0, count: 0 };
      entry[bucketOf(t.type)] += t.amount;
      entry.count += 1;
      byDay.set(day, entry);
    }

    const points: DayPoint[] = [];
    let running = 0;
    let prevRunning = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const entry = byDay.get(day);
      const fixed = entry?.fixed ?? 0;
      const purchases = entry?.purchases ?? 0;
      const consumables = entry?.consumables ?? 0;
      const total = fixed + purchases + consumables;
      const isFuture = day > elapsedDays;
      running += total;
      prevRunning += prevMonth.byDay.get(day) ?? 0;
      points.push({
        day,
        dateLabel: new Date(selectedMonth.year, selectedMonth.month, day).toLocaleDateString(
          'en-GB',
          { weekday: 'short', day: 'numeric', month: 'short' }
        ),
        fixed,
        purchases,
        consumables,
        total,
        count: entry?.count ?? 0,
        isFuture,
        cumulative: isFuture ? null : running,
        prevCumulative: prevMonth.total > 0 ? prevRunning : null,
      });
    }
    return points;
  }, [expenseTransactions, selectedMonth, daysInMonth, elapsedDays, prevMonth]);

  const peakDay = useMemo(
    () =>
      dailyChartData.reduce<DayPoint | null>(
        (best, d) => (d.total > 0 && (!best || d.total > best.total) ? d : best),
        null
      ),
    [dailyChartData]
  );
  const noSpendDays = dailyChartData.filter((d) => !d.isFuture && d.total === 0).length;
  const bucketTotals = useMemo(
    () =>
      BUCKETS.map((b) => ({
        ...b,
        total: dailyChartData.reduce((sum, d) => sum + d[b.key], 0),
      })),
    [dailyChartData]
  );

  const lastElapsed = dailyChartData[elapsedDays - 1];
  const paceCurrent = lastElapsed?.cumulative ?? 0;
  const pacePrevious = lastElapsed?.prevCumulative ?? null;
  const paceDelta =
    pacePrevious !== null && pacePrevious > 0
      ? ((paceCurrent - pacePrevious) / pacePrevious) * 100
      : null;

  const hasActiveFilters =
    searchQuery !== '' || typeFilter !== 'all' || methodFilter !== 'all' || dayFilter !== null;

  const filteredExpenses = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return expenseTransactions.filter((t) => {
      if (
        q &&
        !t.description.toLowerCase().includes(q) &&
        !(t.supplier ?? '').toLowerCase().includes(q)
      )
        return false;
      if (typeFilter === 'variable' && t.type !== 'expense_product') return false;
      if (typeFilter === 'fixed' && t.type !== 'expense_fixed') return false;
      if (typeFilter === 'consumable' && t.type !== 'expense_consumable') return false;
      if (methodFilter !== 'all' && t.method !== methodFilter) return false;
      if (dayFilter !== null && t.date.getDate() !== dayFilter) return false;
      return true;
    });
  }, [expenseTransactions, searchQuery, typeFilter, methodFilter, dayFilter]);

  // ── Modal state ──────────────────────────────────────────────────────────
  const [passwordModal, setPasswordModal] = useState<PasswordModalState>(CLOSED_PASSWORD_MODAL);
  const [editModal, setEditModal] = useState<EditModalState>(CLOSED_EDIT_MODAL);

  // ── Pagination ───────────────────────────────────────────────────────────
  const { paginatedData: paginatedExpenses, pagination } = useClientPagination(filteredExpenses, {
    initialPageSize: 10,
    pageSizeOptions: [5, 10, 20],
  });

  const exportConfig = useMemo(
    () => ({
      filenameBase: `expenses_${monthLabel.replace(/\s+/g, '_').toLowerCase()}`,
      title: 'All Expenses',
      subtitle: monthLabel,
      columns: TRANSACTION_EXPORT_COLUMNS,
      sheetName: 'Expenses',
      getData: () => filteredExpenses,
    }),
    [filteredExpenses, monthLabel]
  );

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleManagerDelete = useCallback(
    (id: string) => {
      setPasswordModal({
        isOpen: true,
        title: 'Delete Transaction',
        requiredRole: 'owner',
        action: async () => {
          try {
            await deleteTransaction(id);
            toast.success('Expense deleted successfully.');
          } catch (error) {
            handleError(error, {
              action: 'delete_expense',
              severity: 'high',
              metadata: { transactionId: id },
            });
          }
        },
      });
    },
    [deleteTransaction]
  );

  const handleManagerEdit = useCallback((transaction: Transaction) => {
    setPasswordModal({
      isOpen: true,
      title: 'Edit Transaction',
      requiredRole: 'owner',
      action: () => setEditModal({ isOpen: true, transaction }),
    });
  }, []);

  const handleSaveEdit = useCallback(
    (updated: Transaction) => {
      try {
        updateTransaction(updated);
        toast.success('Expense updated successfully.');
      } catch (error) {
        handleError(error, {
          action: 'update_expense',
          severity: 'high',
          metadata: { transactionId: updated.id },
        });
      }
    },
    [updateTransaction]
  );

  const handlePasswordConfirm = useCallback(() => {
    passwordModal.action?.();
    setPasswordModal(CLOSED_PASSWORD_MODAL);
  }, [passwordModal]);

  const handlePasswordClose = useCallback(() => setPasswordModal(CLOSED_PASSWORD_MODAL), []);
  const handleEditClose = useCallback(() => setEditModal(CLOSED_EDIT_MODAL), []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setTypeFilter('all');
    setMethodFilter('all');
    setDayFilter(null);
  }, []);

  // ── Chart helpers ────────────────────────────────────────────────────────
  const barCells = (color: string) =>
    dailyChartData.map((d) => (
      <Cell
        key={d.day}
        fill={color}
        opacity={dayFilter !== null && dayFilter !== d.day ? 0.3 : 1}
      />
    ));

  const handleBarClick = (_: unknown, index: number) => {
    const point = dailyChartData[index];
    if (point && !point.isFuture && point.total > 0) toggleDay(point.day);
  };

  const chartSummary = `${monthLabel} daily expenses: total ${fmtTk(monthlyTotal)} over ${activeDays} active days${
    peakDay ? `, highest on day ${peakDay.day} at ${fmtTk(peakDay.total)}` : ''
  }.`;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-[calc(100dvh-6rem)] flex-col gap-3 overflow-y-auto pb-20 animate-in fade-in zoom-in-95 sm:gap-4 sm:pb-8">
      <ManagerPasswordModal
        isOpen={passwordModal.isOpen}
        onClose={handlePasswordClose}
        onConfirm={handlePasswordConfirm}
        title={passwordModal.title}
        requiredRole={passwordModal.requiredRole}
      />
      <EditTransactionModal
        isOpen={editModal.isOpen}
        onClose={handleEditClose}
        transaction={editModal.transaction}
        onSave={handleSaveEdit}
        itemNames={itemNames}
        suppliers={suppliers.map((s) => s.name)}
      />

      <details className="group shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 sm:px-5 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <TrendingDown size={17} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-800">Insights</span>
              <span className="block truncate text-xs text-erp-secondary">
                {monthLabel} · Monthly totals, spending pattern, payment methods, and suppliers
              </span>
            </span>
          </span>
          <ChevronDown
            size={17}
            className="shrink-0 text-slate-400 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>

        <div className="space-y-4 border-t border-slate-100 bg-slate-50/40 p-3 sm:p-5">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
            <MiniStat
              label="Total Expenses"
              value={fmtTk(monthlyTotal)}
              icon={TrendingDown}
              iconColor="text-rose-600"
              iconBg="bg-rose-100"
              valueColor="text-rose-600"
            />
            <MiniStat
              label="Fixed Expenses"
              value={fmtTk(fixedTotal)}
              icon={Layers}
              iconColor="text-purple-600"
              iconBg="bg-purple-100"
            />
            <MiniStat
              label="Purchases"
              value={fmtTk(variableTotal)}
              icon={Tag}
              iconColor="text-orange-600"
              iconBg="bg-orange-100"
            />
            <MiniStat
              label="Consumables"
              value={fmtTk(consumableTotal)}
              icon={Boxes}
              iconColor="text-teal-600"
              iconBg="bg-teal-100"
            />
            <MiniStat
              label="Avg / Active Day"
              value={fmtTk(avgDailyExpense)}
              icon={Activity}
              iconColor="text-indigo-600"
              iconBg="bg-indigo-100"
            />
          </div>

          {expenseTransactions.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3">
              {/* ── Daily spend pattern ── */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:col-span-2">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-700">Daily spend pattern</h4>
                    <p className="mt-0.5 text-[11px] text-slate-400 sm:text-xs">
                      {monthLabel} · {activeDays} active day{activeDays !== 1 ? 's' : ''}
                      {chartView === 'daily' && ' · select a bar to filter the table'}
                    </p>
                  </div>
                  <div
                    role="group"
                    aria-label="Chart view"
                    className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
                  >
                    {(
                      [
                        ['daily', 'Daily'],
                        ['cumulative', 'Running total'],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setChartView(value)}
                        aria-pressed={chartView === value}
                        className={`rounded-md px-3 py-1.5 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
                          chartView === value
                            ? 'bg-white text-rose-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <ChartChip
                    icon={TrendingUp}
                    label="Highest day"
                    value={peakDay ? `${peakDay.dateLabel}` : '—'}
                    sub={peakDay ? fmtTk(peakDay.total) : undefined}
                  />
                  <ChartChip
                    icon={CalendarDays}
                    label="No-spend days"
                    value={`${noSpendDays} of ${elapsedDays}`}
                    sub={isCurrentMonth ? 'So far this month' : 'In this month'}
                  />
                  <ChartChip
                    icon={Activity}
                    label={`Pace vs ${prevMonth.label}`}
                    value={
                      paceDelta === null
                        ? 'No earlier data'
                        : `${paceDelta >= 0 ? '+' : ''}${paceDelta.toFixed(1)}%`
                    }
                    sub={
                      pacePrevious !== null
                        ? `${fmtTk(paceCurrent)} vs ${fmtTk(pacePrevious)}`
                        : undefined
                    }
                    tone={
                      paceDelta === null
                        ? 'text-slate-800'
                        : paceDelta > 0
                          ? 'text-rose-600'
                          : 'text-emerald-600'
                    }
                  />
                </div>

                <div
                  role="img"
                  aria-label={chartSummary}
                  className="h-48 w-full sm:h-56 [&_.recharts-bar-rectangle]:cursor-pointer"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    {chartView === 'daily' ? (
                      <BarChart
                        data={dailyChartData}
                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis
                          dataKey="day"
                          tick={{ fontSize: 10, fill: '#94a3b8' }}
                          axisLine={false}
                          tickLine={false}
                          interval={dailyChartData.length > 20 ? 4 : 2}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: '#94a3b8' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={fmtAxis}
                          width={40}
                        />
                        <RechartsTooltip
                          content={
                            <DailyExpenseTooltip
                              view="daily"
                              avg={avgDailyExpense}
                              prevLabel={prevMonth.label}
                            />
                          }
                          cursor={{ fill: '#f1f5f9' }}
                        />
                        {avgDailyExpense > 0 && (
                          <ReferenceLine
                            y={avgDailyExpense}
                            stroke="#94a3b8"
                            strokeDasharray="4 4"
                            label={{
                              value: 'Avg',
                              position: 'insideTopRight',
                              fontSize: 10,
                              fill: '#64748b',
                            }}
                          />
                        )}
                        {isCurrentMonth && <ReferenceLine x={now.getDate()} stroke="#cbd5e1" />}
                        {BUCKETS.map((b) => (
                          <Bar
                            key={b.key}
                            dataKey={b.key}
                            stackId="spend"
                            fill={b.color}
                            maxBarSize={28}
                            onClick={handleBarClick}
                          >
                            {barCells(b.color)}
                          </Bar>
                        ))}
                      </BarChart>
                    ) : (
                      <AreaChart
                        data={dailyChartData}
                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis
                          dataKey="day"
                          tick={{ fontSize: 10, fill: '#94a3b8' }}
                          axisLine={false}
                          tickLine={false}
                          interval={dailyChartData.length > 20 ? 4 : 2}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: '#94a3b8' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={fmtAxis}
                          width={40}
                        />
                        <RechartsTooltip
                          content={
                            <DailyExpenseTooltip
                              view="cumulative"
                              avg={avgDailyExpense}
                              prevLabel={prevMonth.label}
                            />
                          }
                        />
                        <Area
                          type="monotone"
                          dataKey="prevCumulative"
                          stroke="#94a3b8"
                          strokeDasharray="4 4"
                          fill="none"
                          dot={false}
                          isAnimationActive={false}
                        />
                        <Area
                          type="monotone"
                          dataKey="cumulative"
                          stroke="#e11d48"
                          strokeWidth={2}
                          fill="#fb7185"
                          fillOpacity={0.15}
                          dot={false}
                        />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </div>

                <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500">
                  {chartView === 'daily' ? (
                    bucketTotals.map((b) => (
                      <li key={b.key} className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${b.dot}`} />
                        {b.label}
                        <span className="font-semibold tabular-nums text-slate-700">
                          {fmtTk(b.total)}
                        </span>
                      </li>
                    ))
                  ) : (
                    <>
                      <li className="flex items-center gap-1.5">
                        <span className="h-0.5 w-4 rounded bg-rose-600" />
                        {monthLabel}
                      </li>
                      {prevMonth.total > 0 && (
                        <li className="flex items-center gap-1.5">
                          <span className="h-0 w-4 border-t-2 border-dashed border-slate-400" />
                          {prevMonth.label}
                        </li>
                      )}
                    </>
                  )}
                </ul>
              </div>

              {/* ── Sidebar panels ── */}
              <div className="flex flex-col gap-4">
                <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <h4 className="mb-3 text-sm font-bold text-slate-700">Payment methods</h4>
                  <div className="space-y-3 sm:space-y-2.5">
                    {(
                      Object.entries(METHOD_CONFIG) as [string, (typeof METHOD_CONFIG)[string]][]
                    ).map(([key, cfg]) => {
                      const amount = methodBreakdown[key as keyof typeof methodBreakdown];
                      const pct = monthlyTotal > 0 ? Math.round((amount / monthlyTotal) * 100) : 0;
                      const Icon = cfg.icon;
                      return (
                        <div key={key} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className={`rounded-lg p-1.5 ${cfg.bg}`}>
                                <Icon size={14} className={cfg.color} />
                              </div>
                              <span className="text-xs font-semibold text-slate-600">
                                {cfg.label}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-bold text-slate-700">
                                {fmtTk(amount)}
                              </span>
                              <span className="ml-1.5 inline-block w-8 text-[10px] text-slate-400">
                                {pct}%
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                key === 'cash'
                                  ? 'bg-emerald-400'
                                  : key === 'bank'
                                    ? 'bg-blue-400'
                                    : 'bg-pink-400'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {topSuppliers.length > 0 && (
                  <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <h4 className="mb-3 text-sm font-bold text-slate-700">Top suppliers</h4>
                    <div className="space-y-2.5">
                      {topSuppliers.map(({ name, total }, idx) => (
                        <div key={name} className="flex items-center gap-2.5">
                          <span className="w-5 shrink-0 text-[10px] font-bold text-slate-400">
                            #{idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center justify-between">
                              <span className="mr-2 truncate text-xs font-semibold text-slate-600">
                                {name}
                              </span>
                              <span className="shrink-0 text-xs font-bold tabular-nums text-slate-700">
                                {fmtTk(total)}
                              </span>
                            </div>
                            <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-rose-300"
                                style={{
                                  width: `${Math.round((total / (topSuppliers[0]?.total || 1)) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </details>

      {/* ── Table card — takes the remaining height on desktop ── */}
      <div className="flex shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:min-h-[18rem] lg:flex-1 lg:shrink">
        {/* Filter bar */}
        <div className="shrink-0 border-b border-slate-100 bg-slate-50/50 p-4 md:p-5">
          <div className="flex flex-col space-y-3 sm:space-y-4">
            <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
              <div className="relative w-full xl:max-w-xs">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  aria-label="Search expenses by description or supplier"
                  placeholder="Search description or supplier…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-9 text-xs text-slate-700 transition-colors placeholder:text-slate-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200 sm:py-2.5 sm:text-sm"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex w-full flex-wrap items-center gap-2 sm:gap-3 xl:w-auto xl:justify-end">
                <MonthNavigator
                  label={monthLabel}
                  onPrev={goToPrevMonth}
                  onNext={goToNextMonth}
                  disableNext={isCurrentMonth}
                />
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs font-semibold text-slate-500 underline underline-offset-2 transition-colors hover:text-slate-700"
                  >
                    Clear filters
                  </button>
                )}
                <div className="ml-auto shrink-0 xl:ml-0">
                  <ExportDropdown config={exportConfig} disabled={filteredExpenses.length === 0} />
                </div>
              </div>
            </div>

            <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div
                role="group"
                aria-label="Expense type"
                className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white p-1"
              >
                {(
                  [
                    ['all', 'All'],
                    ['fixed', 'Fixed expenses'],
                    ['variable', 'Purchases'],
                    ['consumable', 'Consumables'],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTypeFilter(val)}
                    aria-pressed={typeFilter === val}
                    className={`whitespace-nowrap rounded-md px-3 py-1.5 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 sm:py-1 ${
                      typeFilter === val
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div
                role="group"
                aria-label="Payment method"
                className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white p-1"
              >
                {(['all', 'cash', 'bank', 'bkash'] as const).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setMethodFilter(val)}
                    aria-pressed={methodFilter === val}
                    className={`whitespace-nowrap rounded-md px-3 py-1.5 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 sm:py-1 ${
                      methodFilter === val
                        ? 'bg-slate-700 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    }`}
                  >
                    {val === 'all' ? 'All' : METHOD_CONFIG[val]?.label}
                  </button>
                ))}
              </div>

              {dayFilter !== null && (
                <button
                  type="button"
                  onClick={() => setDayFilter(null)}
                  aria-label={`Remove day ${dayFilter} filter`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-700 transition-colors hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                >
                  <CalendarDays size={12} aria-hidden="true" />
                  Day {dayFilter}
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {hasActiveFilters && (
            <p className="mt-3 border-t border-slate-200/60 pt-3 text-[11px] text-slate-500">
              Showing <span className="font-bold text-slate-700">{filteredExpenses.length}</span> of{' '}
              <span className="font-bold text-slate-700">{expenseTransactions.length}</span>{' '}
              expenses
            </p>
          )}
        </div>

        {/* Table */}
        <div className="max-h-[65dvh] min-h-[12rem] w-full overflow-auto [scrollbar-width:thin] lg:max-h-none lg:min-h-0 lg:flex-1 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
          <table className="w-full min-w-[750px] text-left">
            <thead className="sticky top-0 z-10 border-b-2 border-slate-200 bg-slate-50">
              <tr>
                {TABLE_COLUMNS.map((col) => (
                  <th
                    key={col}
                    scope="col"
                    className={`bg-slate-50 px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:px-5${
                      RIGHT_ALIGNED_COLUMNS.has(col) ? ' text-right' : ''
                    }`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.length === 0 ? (
                <EmptyState hasFilters={hasActiveFilters} />
              ) : (
                paginatedExpenses.map((t) => {
                  const typeConfig = EXPENSE_TYPE_CONFIG[t.type] ?? DEFAULT_TYPE_CONFIG;
                  const methodCfg = METHOD_CONFIG[t.method ?? 'cash'];
                  const MethodIcon = methodCfg?.icon;
                  return (
                    <tr key={t.id} className="group transition-colors hover:bg-rose-50/40">
                      <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-600 sm:px-5 sm:py-3.5">
                        {t.date?.toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 sm:px-5 sm:py-3.5">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${typeConfig.className}`}
                        >
                          {typeConfig.label}
                        </span>
                      </td>
                      <td className="max-w-[180px] px-4 py-3 text-xs text-slate-700 sm:max-w-[220px] sm:px-5 sm:py-3.5">
                        <span className="line-clamp-1">{t.description}</span>
                        {t.category && (
                          <span className="mt-1 block text-[10px] text-slate-400">
                            {t.category}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 sm:px-5 sm:py-3.5">
                        {t.supplier ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            {t.supplier}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 sm:px-5 sm:py-3.5">
                        {methodCfg ? (
                          <span
                            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold ${methodCfg.bg} ${methodCfg.color}`}
                          >
                            {MethodIcon && <MethodIcon size={12} />}
                            {methodCfg.label}
                          </span>
                        ) : (
                          <span className="text-xs capitalize text-slate-500">{t.method}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right sm:px-5 sm:py-3.5">
                        <span className="whitespace-nowrap text-sm font-extrabold tabular-nums text-rose-600">
                          -{fmtTk(t.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 sm:px-5 sm:py-3.5">
                        {canMutate && (
                          // Always visible on touch devices; hover-reveal only on desktop
                          <div className="flex justify-end gap-1.5 opacity-100 transition-opacity lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
                            <button
                              onClick={() => handleManagerEdit(t)}
                              aria-label="Edit transaction (Owner Only)"
                              title="Edit (Owner Only)"
                              className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-slate-50 px-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 lg:bg-transparent"
                            >
                              <Pencil size={14} aria-hidden="true" /> Edit
                            </button>
                            <button
                              onClick={() => handleManagerDelete(t.id)}
                              aria-label="Delete transaction (Owner Only)"
                              title="Delete (Owner Only)"
                              className="rounded-lg bg-slate-50 p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 sm:p-1.5 lg:bg-transparent"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer: record count + pagination */}
        {filteredExpenses.length > 0 && (
          <div className="flex shrink-0 flex-col items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-4 py-3.5 sm:px-5 md:flex-row">
            <p className="w-full text-center text-xs text-slate-500 md:text-left">
              <span className="font-bold text-slate-700">Total {filteredExpenses.length} expenses</span>
              {/* {filteredExpenses.length !== 1 ? 's' : ''} ·{' '}
              <span className="font-bold text-rose-600">
                {fmtTk(filteredExpenses.reduce((s, t) => s + t.amount, 0))}
              </span>{' '} */}
            </p>
            <div className="w-full md:w-auto">
              <Pagination pagination={pagination} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
