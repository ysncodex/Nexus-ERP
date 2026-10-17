import { Fragment, useMemo, useState, useEffect, useRef } from 'react';

import {
  Calendar,
  Pencil,
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Eye,
  X,
  DollarSign,
  Wallet,
  Activity,
  Trophy,
  type LucideIcon,
} from 'lucide-react';

import { toast } from 'sonner';

import { useERP } from '@/core/context/useERP';

import { computeDailyRecords } from '@/core/context/erp/dailyRecords';

import type { DailyRecord } from '@/core/types';

import { useClientPagination } from '@/shared/hooks';

import { ManagerPasswordModal, Pagination } from '@/shared/components/ui';

import { getStoredUser, handleError, canMutateData } from '@/shared/utils';

import { ExportDropdown, DAILY_RECORD_EXPORT_COLUMNS } from '@/shared/export';

// ─── Types ────────────────────────────────────────────────────────────────────

type SortField =
  | 'date'
  | 'totalSales'
  | 'cashSales'
  | 'bkashSales'
  | 'bankSales'
  | 'foodpandaSales'
  | 'foodiSales'
  | 'dailyCosts'
  | 'dailyAvail';

type EnrichedRecord = DailyRecord;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString();
}

function SortIcon({
  field,
  activeField,
  direction,
}: {
  field: SortField;
  activeField: SortField;
  direction: 'asc' | 'desc';
}) {
  // Arrows = sorting. Chevrons are reserved for expand / navigation.
  if (activeField !== field) return <ArrowUpDown size={12} className="text-slate-400 shrink-0" />;

  return direction === 'asc' ? (
    <ArrowUp size={12} className="text-indigo-500 shrink-0" />
  ) : (
    <ArrowDown size={12} className="text-indigo-500 shrink-0" />
  );
}

function SortTh({
  field,
  label,
  activeField,
  direction,
  onSort,
  align = 'right',
  dot,
  className = '',
}: {
  field: SortField;
  label: string;
  activeField: SortField;
  direction: 'asc' | 'desc';
  onSort: (field: SortField) => void;
  align?: 'left' | 'right';
  dot?: string;
  className?: string;
}) {
  const isActive = field === activeField;
  return (
    <th
      scope="col"
      aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`select-none px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 transition-colors hover:bg-slate-100 ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1.5 whitespace-nowrap uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
      >
        {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
        {label}
        <SortIcon field={field} activeField={activeField} direction={direction} />
      </button>
    </th>
  );
}

function AmountCell({
  value,

  positive,

  neutral,

  dot,
}: {
  value: number;

  positive?: boolean;

  neutral?: boolean;

  dot?: string;
}) {
  if (value === 0) return <span className="text-slate-300">—</span>;

  const color = neutral
    ? 'text-slate-700'
    : positive
      ? value >= 0
        ? 'text-emerald-600'
        : 'text-rose-500'
      : 'text-slate-700';

  return (
    <span
      className={`inline-flex items-center justify-end gap-1.5 font-semibold tabular-nums whitespace-nowrap ${color}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />}
      {fmt(value)} ৳
    </span>
  );
}

/** Amount for a delivery channel (Foodpanda/Foodi) with tiny dots + tooltip
 * showing which payment method(s) the money actually came in through — since
 * the channel and payment method are separate dimensions on the ledger. */
function ChannelAmountCell({
  value,

  cash,

  bkash,

  bank,

  dot,
}: {
  value: number;

  cash: number;

  bkash: number;

  bank: number;

  dot: string;
}) {
  if (value === 0) return <span className="text-slate-300">—</span>;

  const parts: string[] = [];

  if (cash) parts.push(`Cash: ${fmt(cash)} ৳`);

  if (bkash) parts.push(`bKash: ${fmt(bkash)} ৳`);

  if (bank) parts.push(`Bank: ${fmt(bank)} ৳`);

  return (
    <span
      title={parts.length ? `Received via ${parts.join(' · ')}` : undefined}
      className="inline-flex items-center justify-end gap-1.5 font-semibold tabular-nums whitespace-nowrap text-slate-700"
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      {fmt(value)} ৳
      <span className="inline-flex items-center gap-0.5">
        {cash > 0 && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="via Cash" />
        )}

        {bkash > 0 && (
          <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500 shrink-0" title="via bKash" />
        )}

        {bank > 0 && (
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" title="via Bank" />
        )}
      </span>
    </span>
  );
}

// ─── Summary pieces ───────────────────────────────────────────────────────────

/** One labelled figure inside the performance card. */
function Stat({
  label,
  value,
  sub,
  icon: Icon,
  iconColor,
  iconBg,
  valueColor = 'text-slate-800',
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  valueColor?: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <div className={`shrink-0 rounded-lg p-2 ${iconBg}`}>
        <Icon size={16} strokeWidth={2.5} className={iconColor} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <dt className="text-[11px] font-medium text-slate-500">{label}</dt>
        <dd
          className={`truncate text-base font-extrabold tabular-nums leading-tight ${valueColor}`}
          title={value}
        >
          {value}
        </dd>
        {sub && <dd className="mt-0.5 truncate text-[11px] text-slate-400">{sub}</dd>}
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  description,
  children,
  className = '',
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}
    >
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      <p className="mb-4 mt-0.5 text-xs text-slate-500">{description}</p>
      {children}
    </section>
  );
}

interface SelectedMonth {
  year: number;

  month: number;
}

interface MonthNavigatorProps {
  label: string;

  onPrev: () => void;

  onNext: () => void;

  disableNext: boolean;
}

function MonthNavigator({ label, onPrev, onNext, disableNext }: MonthNavigatorProps) {
  return (
    <div className="flex items-center justify-between sm:justify-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1.5 shadow-sm w-full sm:w-auto">
      <button
        type="button"
        onClick={onPrev}
        aria-label="Previous month"
        className="p-2 sm:p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <ChevronLeft size={16} />
      </button>

      <span
        aria-live="polite"
        className="text-sm font-bold text-slate-700 min-w-[130px] text-center select-none px-2"
      >
        {label}
      </span>

      <button
        type="button"
        onClick={onNext}
        disabled={disableNext}
        aria-label="Next month"
        className="p-2 sm:p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

const shortDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function DailyRecord() {
  const now = new Date();

  const { transactions, addTransaction } = useERP();

  const canEdit = canMutateData(getStoredUser()?.role);

  const [selectedMonth, setSelectedMonth] = useState<SelectedMonth>({
    year: now.getFullYear(),

    month: now.getMonth(),
  });

  const [summaryOpen, setSummaryOpen] = useState(true);

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

  const monthStart = useMemo(
    () => new Date(selectedMonth.year, selectedMonth.month, 1),

    [selectedMonth]
  );

  const monthEnd = useMemo(
    () => new Date(selectedMonth.year, selectedMonth.month + 1, 0, 23, 59, 59, 999),

    [selectedMonth]
  );

  const goToPrevMonth = () =>
    setSelectedMonth((prev) =>
      prev.month === 0
        ? { year: prev.year - 1, month: 11 }
        : { year: prev.year, month: prev.month - 1 }
    );

  const goToNextMonth = () =>
    setSelectedMonth((prev) =>
      prev.month === 11
        ? { year: prev.year + 1, month: 0 }
        : { year: prev.year, month: prev.month + 1 }
    );

  const monthTransactions = useMemo(
    () =>
      transactions.filter(
        (t) => t.date instanceof Date && t.date >= monthStart && t.date <= monthEnd
      ),

    [transactions, monthStart, monthEnd]
  );

  const enrichedRecords = useMemo<EnrichedRecord[]>(
    () => computeDailyRecords(monthTransactions),

    [monthTransactions]
  );

  // ── Sort state ────────────────────────────────────────────────────────────

  const [sortField, setSortField] = useState<SortField>('date');

  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);

      setSortDir('desc');
    }
  };

  // ── Owner Password Modal ───────────────────────────────────────────────────

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const [passwordModalTitle, setPasswordModalTitle] = useState('');

  // ── Edit Modal ─────────────────────────────────────────────────────────────

  const [editModalOpen, setEditModalOpen] = useState(false);

  const [editingRecord, setEditingRecord] = useState<DailyRecord | null>(null);

  const [editValues, setEditValues] = useState({ cashSales: 0, bkashSales: 0, bankSales: 0 });

  // ── Detail Modal ───────────────────────────────────────────────────────────

  const [detailRecord, setDetailRecord] = useState<EnrichedRecord | null>(null);

  // ── Action row menu ────────────────────────────────────────────────────────

  const [openMenuDate, setOpenMenuDate] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!openMenuDate) return;

    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuDate(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenuDate(null);
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openMenuDate]);

  // ── Sort ───────────────────────────────────────────────────────────────────

  const sortedRecords = useMemo(() => {
    return [...enrichedRecords].sort((a, b) => {
      const cmp =
        sortField === 'date'
          ? new Date(a.date).getTime() - new Date(b.date).getTime()
          : a[sortField] - b[sortField];

      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [enrichedRecords, sortField, sortDir]);

  // ── Footer totals (full range, not just current page) ─────────────────────

  const totals = useMemo(() => {
    return enrichedRecords.reduce(
      (acc, r) => ({
        cashSales: acc.cashSales + r.cashSales,

        bkashSales: acc.bkashSales + r.bkashSales,

        bankSales: acc.bankSales + r.bankSales,

        foodpandaSales: acc.foodpandaSales + r.foodpandaSales,

        foodiSales: acc.foodiSales + r.foodiSales,

        dailyCosts: acc.dailyCosts + r.dailyCosts,

        dailyAvail: acc.dailyAvail + r.dailyAvail,
      }),

      {
        cashSales: 0,

        bkashSales: 0,

        bankSales: 0,

        foodpandaSales: 0,

        foodiSales: 0,

        dailyCosts: 0,

        dailyAvail: 0,
      }
    );
  }, [enrichedRecords]);

  // ── Period summary stats ───────────────────────────────────────────────────

  const summaryStats = useMemo(() => {
    if (enrichedRecords.length === 0) return null;

    const totalRevenue = enrichedRecords.reduce((s, r) => s + r.totalSales, 0);

    const totalExpenses = enrichedRecords.reduce((s, r) => s + r.dailyCosts, 0);

    const netCashFlow = enrichedRecords.reduce((s, r) => s + r.dailyAvail, 0);

    const profitableDays = enrichedRecords.filter((r) => r.dailyAvail > 0).length;

    const avgDailyRevenue = Math.round(totalRevenue / enrichedRecords.length);

    const bestDay = enrichedRecords.reduce((best, r) =>
      r.totalSales > best.totalSales ? r : best
    );

    const worstDay = enrichedRecords.reduce((worst, r) =>
      r.dailyAvail < worst.dailyAvail ? r : worst
    );

    return {
      totalRevenue,

      totalExpenses,

      netCashFlow,

      profitableDays,

      avgDailyRevenue,

      bestDay,

      worstDay,

      days: enrichedRecords.length,
    };
  }, [enrichedRecords]);

  const { paginatedData, pagination } = useClientPagination(sortedRecords, {
    initialPageSize: 10,

    pageSizeOptions: [5, 10, 20, 50],
  });

  const colSpan = 7; // Date, sales, delivery channels, expenses, net flow, and Actions

  const exportConfig = useMemo(
    () => ({
      filenameBase: 'daily_records',

      title: 'Daily Summary',

      subtitle: 'Day-by-day sales, expenses, and result',

      columns: DAILY_RECORD_EXPORT_COLUMNS,

      sheetName: 'Daily Summary',

      getData: () => sortedRecords,

      summaryRows: sortedRecords.length
        ? ([
            ['TOTAL Cash (৳)', totals.cashSales],

            ['TOTAL bKash (৳)', totals.bkashSales],

            ['TOTAL Bank (৳)', totals.bankSales],

            ['TOTAL Foodpanda (৳)', totals.foodpandaSales],

            ['TOTAL Foodi (৳)', totals.foodiSales],

            ['TOTAL Expenses (৳)', totals.dailyCosts],

            ['TOTAL Day Result (৳)', totals.dailyAvail],
          ] as Array<[string, string | number]>)
        : undefined,
    }),

    [sortedRecords, totals]
  );

  // ── Edit handlers ──────────────────────────────────────────────────────────

  const handleManagerEdit = (record: DailyRecord) => {
    setPasswordModalTitle('Edit Daily Sales');

    setPendingAction(() => () => {
      setEditingRecord(record);

      setEditValues({
        cashSales: Number(record.cashSales) || 0,

        bkashSales: Number(record.bkashSales) || 0,

        bankSales: Number(record.bankSales) || 0,
      });

      setEditModalOpen(true);
    });

    setPasswordModalOpen(true);
  };

  const handleSaveEdits = () => {
    try {
      if (!editingRecord?.date) return;

      const date = new Date(editingRecord.date);

      date.setHours(12, 0, 0, 0);

      const current = {
        cashSales: Number(editingRecord.cashSales) || 0,

        bkashSales: Number(editingRecord.bkashSales) || 0,

        bankSales: Number(editingRecord.bankSales) || 0,
      };

      const next = {
        cashSales: Number(editValues.cashSales) || 0,

        bkashSales: Number(editValues.bkashSales) || 0,

        bankSales: Number(editValues.bankSales) || 0,
      };

      const diffs = {
        cash: next.cashSales - current.cashSales,

        bkash: next.bkashSales - current.bkashSales,

        bank: next.bankSales - current.bankSales,
      };

      const dateLabel = new Date(editingRecord.date).toLocaleDateString();

      (['cash', 'bkash', 'bank'] as const).forEach((method) => {
        const diff = diffs[method];

        if (!diff) return;

        addTransaction({
          type: 'sale_adjustment',

          method,

          amount: diff,

          channel: 'in_store',

          description: `Sales adjustment (${dateLabel})`,

          date,
        });
      });

      setEditModalOpen(false);

      setEditingRecord(null);

      toast.success('Sales record updated');
    } catch (error) {
      handleError(error, { action: 'save_daily_record_edits', severity: 'high' });
    }
  };

  // ── Summary-card numbers ──────────────────────────────────────────────────

  const paymentTotal = totals.cashSales + totals.bkashSales + totals.bankSales;
  const cashPct = paymentTotal > 0 ? Math.round((totals.cashSales / paymentTotal) * 100) : 0;
  const bkashPct = paymentTotal > 0 ? Math.round((totals.bkashSales / paymentTotal) * 100) : 0;
  const bankPct = paymentTotal > 0 ? 100 - cashPct - bkashPct : 0;
  const deliveryPct = (amount: number) =>
    paymentTotal > 0 ? Math.round((amount / paymentTotal) * 100) : 0;

  const paymentRows = [
    { label: 'Cash', amount: totals.cashSales, pct: cashPct, dot: 'bg-emerald-400' },
    { label: 'bKash', amount: totals.bkashSales, pct: bkashPct, dot: 'bg-fuchsia-400' },
    { label: 'Bank', amount: totals.bankSales, pct: bankPct, dot: 'bg-sky-400' },
  ];

  const profitRate = summaryStats
    ? Math.round((summaryStats.profitableDays / summaryStats.days) * 100)
    : 0;

  return (
    <div className="flex h-full min-h-[calc(100dvh-6rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white pb-20 shadow-sm animate-in fade-in zoom-in-95 sm:pb-0">
      {/* ── Modals ── */}

      <ManagerPasswordModal
        isOpen={passwordModalOpen}
        onClose={() => {
          setPasswordModalOpen(false);

          setPendingAction(null);
        }}
        onConfirm={() => {
          if (pendingAction) pendingAction();
        }}
        title={passwordModalTitle}
      />

      {/* Edit Modal */}

      {editModalOpen && editingRecord && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit sales"
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg p-5 sm:p-6 pb-8 sm:pb-6 animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-indigo-100 p-3 rounded-xl text-indigo-600">
                <Pencil size={20} />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-800">Edit Sales</h3>

                <p className="text-xs text-slate-500">
                  {new Date(editingRecord.date).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* 1 col on mobile, 3 on desktop */}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-3">
              {(['cashSales', 'bkashSales', 'bankSales'] as const).map((k) => (
                <div key={k}>
                  <label
                    htmlFor={`edit-${k}`}
                    className="text-xs font-bold text-slate-500 uppercase mb-1.5 block"
                  >
                    {k === 'cashSales' ? 'Cash' : k === 'bkashSales' ? 'bKash' : 'Bank'}
                  </label>

                  <input
                    id={`edit-${k}`}
                    type="number"
                    min={0}
                    value={editValues[k]}
                    onChange={(e) => setEditValues((v) => ({ ...v, [k]: Number(e.target.value) }))}
                    className="w-full p-3 sm:p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-6">
              <button
                onClick={() => {
                  setEditModalOpen(false);

                  setEditingRecord(null);
                }}
                className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                Cancel
              </button>

              <button
                onClick={handleSaveEdits}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}

      {detailRecord && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Day details"
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6 pb-8 sm:pb-6 animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="bg-slate-100 p-2.5 rounded-xl">
                  <Calendar size={18} className="text-slate-600" />
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-800">Day Details</h3>

                  <p className="text-[11px] sm:text-xs text-slate-500">
                    {new Date(detailRecord.date).toLocaleDateString('en-US', {
                      weekday: 'long',

                      year: 'numeric',

                      month: 'long',

                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setDetailRecord(null)}
                aria-label="Close details"
                className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                <X size={20} />
              </button>
            </div>

            {/* Revenue breakdown mini-bar */}

            {detailRecord.totalSales > 0 && (
              <div className="mb-4 p-3.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                  Revenue Breakdown
                </p>

                <div className="flex h-2 rounded-full overflow-hidden gap-px mb-2.5">
                  <div
                    className="bg-emerald-400 transition-all"
                    style={{
                      width: `${(detailRecord.cashSales / detailRecord.totalSales) * 100}%`,
                    }}
                  />

                  <div
                    className="bg-fuchsia-400 transition-all"
                    style={{
                      width: `${(detailRecord.bkashSales / detailRecord.totalSales) * 100}%`,
                    }}
                  />

                  <div
                    className="bg-sky-400 transition-all"
                    style={{
                      width: `${(detailRecord.bankSales / detailRecord.totalSales) * 100}%`,
                    }}
                  />
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] sm:text-xs text-slate-500 font-semibold">
                  {detailRecord.cashSales > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                      Cash {((detailRecord.cashSales / detailRecord.totalSales) * 100).toFixed(0)}%
                    </span>
                  )}

                  {detailRecord.bkashSales > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 inline-block" />
                      bKash {((detailRecord.bkashSales / detailRecord.totalSales) * 100).toFixed(0)}
                      %
                    </span>
                  )}

                  {detailRecord.bankSales > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" />
                      Bank {((detailRecord.bankSales / detailRecord.totalSales) * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Delivery platform breakdown */}

            {(detailRecord.foodpandaSales > 0 || detailRecord.foodiSales > 0) && (
              <div className="mb-4 p-3.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Delivery Platforms{' '}
                  <span className="font-normal normal-case text-slate-400">
                    (included in totals above)
                  </span>
                </p>

                {detailRecord.foodpandaSales > 0 && (
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                      Foodpanda
                    </span>

                    <ChannelAmountCell
                      value={detailRecord.foodpandaSales}
                      cash={detailRecord.foodpandaCash}
                      bkash={detailRecord.foodpandaBkash}
                      bank={detailRecord.foodpandaBank}
                      dot="bg-orange-400"
                    />
                  </div>
                )}

                {detailRecord.foodiSales > 0 && (
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                      Foodi
                    </span>

                    <ChannelAmountCell
                      value={detailRecord.foodiSales}
                      cash={detailRecord.foodiCash}
                      bkash={detailRecord.foodiBkash}
                      bank={detailRecord.foodiBank}
                      dot="bg-violet-400"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              {[
                { label: 'Cash Received', value: detailRecord.cashSales, dot: 'bg-emerald-500' },

                { label: 'bKash Received', value: detailRecord.bkashSales, dot: 'bg-fuchsia-500' },

                { label: 'Bank Transfer', value: detailRecord.bankSales, dot: 'bg-sky-500' },

                { label: 'Total Revenue', value: detailRecord.totalSales, bold: true },

                { label: 'Total Expenses', value: detailRecord.dailyCosts, negative: true },
              ].map((row) => (
                <div
                  key={row.label}
                  className={`flex justify-between items-center py-2 sm:py-1.5 ${row.bold ? 'border-t border-slate-100 pt-3 sm:pt-2.5 mt-1' : ''}`}
                >
                  <span
                    className={`text-xs sm:text-sm flex items-center gap-2 ${row.bold ? 'font-bold text-slate-700' : 'text-slate-500'}`}
                  >
                    {row.dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${row.dot}`} />}

                    {row.label}
                  </span>

                  <span
                    className={`text-xs sm:text-sm font-bold tabular-nums ${
                      row.negative && row.value > 0
                        ? 'text-rose-500'
                        : row.bold
                          ? 'text-slate-800'
                          : 'text-slate-700'
                    }`}
                  >
                    {row.negative && row.value > 0 ? '-' : ''}
                    {fmt(row.value)} ৳
                  </span>
                </div>
              ))}

              {/* Gross Profit row */}

              {(() => {
                const grossProfit = detailRecord.totalSales - detailRecord.dailyCosts;

                const margin =
                  detailRecord.totalSales > 0
                    ? ((grossProfit / detailRecord.totalSales) * 100).toFixed(1)
                    : '0.0';

                return (
                  <div className="border-t border-dashed border-slate-200 pt-3 sm:pt-2.5 mt-1 flex flex-wrap justify-between items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-slate-600 flex items-center">
                      Gross Profit
                      <span className="ml-2 text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                        {margin}% margin
                      </span>
                    </span>

                    <span
                      className={`text-xs sm:text-sm font-bold tabular-nums ${grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}
                    >
                      {grossProfit >= 0 ? '+' : ''}
                      {fmt(grossProfit)} ৳
                    </span>
                  </div>
                );
              })()}

              <div className="border-t-2 border-slate-200 pt-3 mt-2 flex justify-between items-center">
                <span className="text-sm sm:text-base font-bold text-slate-700">Day Result</span>

                <span
                  className={`text-base sm:text-lg font-extrabold tabular-nums ${detailRecord.dailyAvail >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}
                >
                  {detailRecord.dailyAvail >= 0 ? '+' : ''}
                  {fmt(detailRecord.dailyAvail)} ৳
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Header ── */}

      <div className="shrink-0 border-b border-slate-100 bg-gradient-to-r from-indigo-50 via-white to-slate-50 p-4 md:px-6 md:py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {enrichedRecords.length > 0 ? (
              <span className="inline-flex bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-bold px-2.5 py-1 rounded-full tabular-nums">
                {enrichedRecords.length} days
              </span>
            ) : (
              <span className="text-sm font-medium text-erp-secondary">No days in this month</span>
            )}

            {summaryStats && (
              <button
                type="button"
                onClick={() => setSummaryOpen((open) => !open)}
                aria-expanded={summaryOpen}
                aria-controls="daily-summary-panel"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                {summaryOpen ? 'Hide summary' : 'Show summary'}
                <ChevronDown
                  size={13}
                  aria-hidden="true"
                  className={`transition-transform ${summaryOpen ? 'rotate-180' : ''}`}
                />
              </button>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="flex justify-end w-full sm:w-auto">
              <ExportDropdown config={exportConfig} disabled={sortedRecords.length === 0} />
            </div>

            <MonthNavigator
              label={monthLabel}
              onPrev={goToPrevMonth}
              onNext={goToNextMonth}
              disableNext={isCurrentMonth}
            />
          </div>
        </div>
      </div>

      {/* ── Body: scrolls on small screens; the table takes the remaining height on desktop ── */}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {/* ── Summary: two cards ── */}

        {summaryStats && summaryOpen && (
          <div
            id="daily-summary-panel"
            className="grid shrink-0 grid-cols-1 gap-4 border-b border-slate-100 bg-slate-50/50 p-4 md:px-6 lg:grid-cols-5"
          >
            {/* Card 1 — where the money came in */}
            <SummaryCard
              title="Revenue channels"
              description="How customers paid, and what came through delivery apps."
              className="lg:col-span-2"
            >
              {paymentTotal > 0 ? (
                <>
                  <div
                    role="img"
                    aria-label={`Cash ${cashPct}%, bKash ${bkashPct}%, Bank ${bankPct}%`}
                    className="mb-4 flex h-2.5 gap-px overflow-hidden rounded-full bg-slate-100"
                  >
                    <div className="bg-emerald-400" style={{ width: `${cashPct}%` }} />
                    <div className="bg-fuchsia-400" style={{ width: `${bkashPct}%` }} />
                    <div className="bg-sky-400" style={{ width: `${bankPct}%` }} />
                  </div>

                  <dl className="space-y-2.5">
                    {paymentRows.map((row) => (
                      <div key={row.label} className="flex items-center justify-between gap-3">
                        <dt className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${row.dot}`} />
                          {row.label}
                        </dt>
                        <dd className="text-xs tabular-nums text-slate-700">
                          <span className="font-bold">{fmt(row.amount)} ৳</span>
                          <span className="ml-2 inline-block w-9 text-right text-slate-400">
                            {row.pct}%
                          </span>
                        </dd>
                      </div>
                    ))}
                  </dl>

                  {(totals.foodpandaSales > 0 || totals.foodiSales > 0) && (
                    <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                      <p className="mb-2 text-[11px] font-semibold text-amber-800">
                        Delivery apps — already inside the totals above, not extra money
                      </p>
                      <dl className="space-y-1.5">
                        {[
                          {
                            label: 'Foodpanda',
                            amount: totals.foodpandaSales,
                            dot: 'bg-orange-400',
                          },
                          { label: 'Foodi', amount: totals.foodiSales, dot: 'bg-violet-400' },
                        ]
                          .filter((row) => row.amount > 0)
                          .map((row) => (
                            <div
                              key={row.label}
                              className="flex items-center justify-between gap-3 text-xs"
                            >
                              <dt className="flex items-center gap-2 text-slate-600">
                                <span className={`h-2 w-2 shrink-0 rounded-full ${row.dot}`} />
                                {row.label}
                              </dt>
                              <dd className="tabular-nums text-slate-700">
                                <span className="font-bold">{fmt(row.amount)} ৳</span>
                                <span className="ml-2 inline-block w-9 text-right text-slate-400">
                                  {deliveryPct(row.amount)}%
                                </span>
                              </dd>
                            </div>
                          ))}
                      </dl>
                    </div>
                  )}
                </>
              ) : (
                <p className="py-6 text-center text-xs text-slate-400">
                  No sales recorded in {monthLabel}.
                </p>
              )}
            </SummaryCard>

            {/* Card 2 — how the month performed */}
            <SummaryCard
              title="Month at a glance"
              description={`${monthLabel} · ${summaryStats.days} day${summaryStats.days !== 1 ? 's' : ''} with records`}
              className="lg:col-span-3"
            >
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Stat
                  label="Money in (revenue)"
                  value={`${fmt(summaryStats.totalRevenue)} ৳`}
                  icon={DollarSign}
                  iconColor="text-indigo-600"
                  iconBg="bg-indigo-100"
                />
                <Stat
                  label="Money out (expenses)"
                  value={`${fmt(summaryStats.totalExpenses)} ৳`}
                  icon={TrendingDown}
                  iconColor="text-rose-500"
                  iconBg="bg-rose-50"
                  valueColor="text-rose-600"
                />
                <Stat
                  label="Left over (day result)"
                  value={`${summaryStats.netCashFlow >= 0 ? '+' : ''}${fmt(summaryStats.netCashFlow)} ৳`}
                  icon={Wallet}
                  iconColor={summaryStats.netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-500'}
                  iconBg={summaryStats.netCashFlow >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}
                  valueColor={summaryStats.netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-500'}
                />
              </dl>

              <div className="my-4 border-t border-slate-100" />

              <div className="mb-4">
                <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-600">
                    <TrendingUp size={14} aria-hidden="true" className="text-emerald-600" />
                    Profitable days
                  </span>
                  <span className="font-bold tabular-nums text-slate-700">
                    {summaryStats.profitableDays} of {summaryStats.days}
                    <span className="ml-1.5 font-medium text-slate-400">({profitRate}%)</span>
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label="Share of profitable days"
                  aria-valuenow={profitRate}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-2 overflow-hidden rounded-full bg-slate-100"
                >
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all"
                    style={{ width: `${profitRate}%` }}
                  />
                </div>
              </div>

              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Stat
                  label="Average sales per day"
                  value={`${fmt(summaryStats.avgDailyRevenue)} ৳`}
                  icon={Activity}
                  iconColor="text-sky-600"
                  iconBg="bg-sky-50"
                />
                <Stat
                  label="Best sales day"
                  value={shortDate(summaryStats.bestDay.date)}
                  sub={`${fmt(summaryStats.bestDay.totalSales)} ৳ sales`}
                  icon={Trophy}
                  iconColor="text-amber-600"
                  iconBg="bg-amber-50"
                />
                <Stat
                  label="Lowest result day"
                  value={shortDate(summaryStats.worstDay.date)}
                  sub={`${summaryStats.worstDay.dailyAvail >= 0 ? '+' : ''}${fmt(summaryStats.worstDay.dailyAvail)} ৳ net`}
                  icon={TrendingDown}
                  iconColor={
                    summaryStats.worstDay.dailyAvail < 0 ? 'text-rose-500' : 'text-slate-500'
                  }
                  iconBg={summaryStats.worstDay.dailyAvail < 0 ? 'bg-rose-50' : 'bg-slate-100'}
                  valueColor={
                    summaryStats.worstDay.dailyAvail < 0 ? 'text-rose-600' : 'text-slate-800'
                  }
                />
              </dl>
            </SummaryCard>
          </div>
        )}

        {/* ── Legend for the delivery dots (one line, replaces the long info strip) ── */}

        <p className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 bg-amber-50/60 px-4 py-2 text-[11px] leading-relaxed text-amber-800 md:px-6">
          <span>
            <strong>Foodpanda</strong> and <strong>Foodi</strong> are channel totals, already
            counted in Cash / bKash / Bank. Dots show how each was paid:
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Cash
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-500" /> bKash
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> Bank
            </span>
          </span>
          <span>Hover an amount for the exact split.</span>
        </p>

        {/* ── Table ── */}

        <div className="flex shrink-0 flex-col lg:min-h-[16rem] lg:flex-1 lg:shrink">
          <div className="max-h-[65dvh] min-h-[12rem] w-full overflow-auto [scrollbar-width:thin] lg:max-h-none lg:min-h-0 lg:flex-1 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
            <table className="w-full min-w-[940px] text-left">
              <caption className="sr-only">
                Daily sales, delivery channels, expenses and result for {monthLabel}
              </caption>
              <thead className="sticky top-0 z-20 bg-slate-50 border-b-2 border-slate-200 shadow-sm">
                <tr>
                  <SortTh
                    field="date"
                    label="Date"
                    activeField={sortField}
                    direction={sortDir}
                    onSort={handleSort}
                    align="left"
                    className="sticky left-0 z-30 w-40 min-w-[10rem] bg-slate-50"
                  />
                  <SortTh
                    field="totalSales"
                    label="Total Sales"
                    activeField={sortField}
                    direction={sortDir}
                    onSort={handleSort}
                  />
                  <SortTh
                    field="foodpandaSales"
                    label="Foodpanda"
                    dot="bg-orange-400"
                    activeField={sortField}
                    direction={sortDir}
                    onSort={handleSort}
                  />
                  <SortTh
                    field="foodiSales"
                    label="Foodi"
                    dot="bg-violet-400"
                    activeField={sortField}
                    direction={sortDir}
                    onSort={handleSort}
                  />
                  <SortTh
                    field="dailyCosts"
                    label="Total Expenses"
                    activeField={sortField}
                    direction={sortDir}
                    onSort={handleSort}
                  />
                  <SortTh
                    field="dailyAvail"
                    label="Day Result"
                    activeField={sortField}
                    direction={sortDir}
                    onSort={handleSort}
                  />
                  <th
                    scope="col"
                    className="sticky right-0 z-30 w-16 min-w-[4rem] bg-slate-50 px-2 sm:px-3 py-3.5 text-right text-[11px] font-bold text-slate-600 uppercase tracking-wider shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.55)]"
                  >
                    <span className="sr-only">Actions</span>
                    <MoreHorizontal size={15} className="ml-auto" aria-hidden="true" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-4 bg-slate-50 rounded-2xl">
                          <Calendar size={28} className="text-slate-300" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-500">No records found</p>
                          <p className="text-xs text-slate-400 mt-1 max-w-[200px] mx-auto leading-relaxed">
                            Switch to a different month to view the daily summary
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((r, idx) => {
                    const dateKey = r.date.toISOString();
                    const isExpanded = expandedDates.has(dateKey);
                    const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40';
                    return (
                      <Fragment key={dateKey}>
                        <tr
                          className={`transition-colors duration-100 hover:bg-indigo-50/50 ${rowBg}`}
                        >
                          <td
                            className={`sticky left-0 z-[2] w-40 min-w-[10rem] border-l-2 px-3 sm:px-4 py-3 sm:py-2.5 ${rowBg} ${r.dailyAvail > 0 ? 'border-emerald-400' : r.dailyAvail < 0 ? 'border-rose-400' : 'border-slate-200'}`}
                          >
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              <button
                                type="button"
                                aria-expanded={isExpanded}
                                aria-controls={`payment-details-${dateKey}`}
                                aria-label={`${isExpanded ? 'Hide' : 'Show'} payment breakdown for ${r.date.toLocaleDateString('en-US')}`}
                                onClick={() =>
                                  setExpandedDates((current) => {
                                    const next = new Set(current);
                                    if (next.has(dateKey)) next.delete(dateKey);
                                    else next.add(dateKey);
                                    return next;
                                  })
                                }
                                className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-indigo-100 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                              >
                                <ChevronDown
                                  size={14}
                                  aria-hidden="true"
                                  className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                />
                              </button>
                              <span className="text-xs font-semibold text-slate-700">
                                {r.date.toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 sm:py-2.5 text-right text-xs">
                            <span className="font-bold tabular-nums text-slate-800 whitespace-nowrap">
                              {r.totalSales > 0 ? (
                                `${fmt(r.totalSales)} ৳`
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3 sm:py-2.5 text-right text-xs">
                            <ChannelAmountCell
                              value={r.foodpandaSales}
                              cash={r.foodpandaCash}
                              bkash={r.foodpandaBkash}
                              bank={r.foodpandaBank}
                              dot="bg-orange-400"
                            />
                          </td>
                          <td className="px-4 py-3 sm:py-2.5 text-right text-xs">
                            <ChannelAmountCell
                              value={r.foodiSales}
                              cash={r.foodiCash}
                              bkash={r.foodiBkash}
                              bank={r.foodiBank}
                              dot="bg-violet-400"
                            />
                          </td>
                          <td className="px-4 py-3 sm:py-2.5 text-right text-xs">
                            {r.dailyCosts > 0 ? (
                              <span className="text-rose-500 font-semibold tabular-nums whitespace-nowrap">
                                -{fmt(r.dailyCosts)} ৳
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 sm:py-2.5 text-right text-xs">
                            <span
                              className={`font-bold tabular-nums whitespace-nowrap ${r.dailyAvail >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}
                            >
                              {r.dailyAvail >= 0 ? '+' : ''}
                              {fmt(r.dailyAvail)} ৳
                            </span>
                          </td>
                          {/* Actions */}

                          <td
                            className={`sticky right-0 z-[2] w-16 min-w-[4rem] ${rowBg} px-2 sm:px-3 py-3 sm:py-2.5 text-right shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.55)]`}
                          >
                            <div
                              className="relative inline-block"
                              ref={openMenuDate === dateKey ? menuRef : undefined}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenMenuDate((d) => (d === dateKey ? null : dateKey))
                                }
                                aria-label={`Actions for ${r.date.toLocaleDateString('en-US')}`}
                                aria-haspopup="menu"
                                aria-expanded={openMenuDate === dateKey}
                                className="p-2 sm:p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                                title="Actions"
                              >
                                <MoreHorizontal size={16} />
                              </button>

                              {openMenuDate === dateKey && (
                                <div
                                  role="menu"
                                  className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1.5 animate-in fade-in zoom-in-95 duration-100"
                                >
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setDetailRecord(r);

                                      setOpenMenuDate(null);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 sm:py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:bg-slate-50"
                                  >
                                    <Eye size={14} />
                                    View Details
                                  </button>

                                  {canEdit && (
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        setOpenMenuDate(null);

                                        handleManagerEdit(r);
                                      }}
                                      className="w-full flex items-center gap-2.5 px-4 py-2.5 sm:py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors focus-visible:outline-none focus-visible:bg-indigo-50"
                                    >
                                      <Pencil size={14} />
                                      Edit Sales
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr id={`payment-details-${dateKey}`} className="bg-indigo-50/50">
                            <td colSpan={colSpan} className="border-b border-indigo-100 px-4 py-3">
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                                  <span className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                    Cash Received
                                  </span>
                                  <AmountCell value={r.cashSales} neutral />
                                </div>
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                                  <span className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                                    <span className="h-2 w-2 rounded-full bg-fuchsia-500" />
                                    bKash Received
                                  </span>
                                  <AmountCell value={r.bkashSales} neutral />
                                </div>
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                                  <span className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                                    <span className="h-2 w-2 rounded-full bg-sky-500" />
                                    Bank Transfer
                                  </span>
                                  <AmountCell value={r.bankSales} neutral />
                                </div>
                              </div>
                              <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                                These are the day’s totals by payment method. Foodpanda and Foodi
                                above are channel totals; their colored dots show which payment
                                methods were used.
                              </p>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
              {enrichedRecords.length > 0 && (
                <tfoot className="sticky bottom-0 z-10 bg-slate-100 border-t-2 border-slate-300">
                  <tr>
                    <td className="sticky left-0 z-[2] w-40 min-w-[10rem] bg-slate-100 px-4 py-3.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap border-l-2 border-slate-400">
                      Total ({enrichedRecords.length} days)
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-xs font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        {fmt(paymentTotal)} ৳
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-xs font-bold text-orange-600 tabular-nums whitespace-nowrap">
                        {fmt(totals.foodpandaSales)} ৳
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-xs font-bold text-violet-600 tabular-nums whitespace-nowrap">
                        {fmt(totals.foodiSales)} ৳
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-xs font-bold text-rose-500 tabular-nums whitespace-nowrap">
                        -{fmt(totals.dailyCosts)} ৳
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span
                        className={`text-xs font-bold tabular-nums whitespace-nowrap ${totals.dailyAvail >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}
                      >
                        {totals.dailyAvail >= 0 ? '+' : ''}
                        {fmt(totals.dailyAvail)} ৳
                      </span>
                    </td>
                    <td className="sticky right-0 z-[2] w-16 min-w-[4rem] bg-slate-100 shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.55)]" />
                  </tr>
                  <tr>
                    <td
                      colSpan={colSpan}
                      className="bg-slate-50 px-4 py-2 text-[10px] font-medium text-slate-500"
                    >
                      Payment totals — Cash:{' '}
                      <span className="font-bold text-emerald-700">{fmt(totals.cashSales)} ৳</span>{' '}
                      · bKash:{' '}
                      <span className="font-bold text-fuchsia-700">{fmt(totals.bkashSales)} ৳</span>{' '}
                      · Bank:{' '}
                      <span className="font-bold text-sky-700">{fmt(totals.bankSales)} ৳</span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* ── Pagination (pinned to the bottom) ── */}

      {enrichedRecords.length > 0 && (
        <div className="shrink-0 px-4 sm:px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs sm:text-sm text-slate-500 w-full text-center md:text-left leading-relaxed">
            <span className="font-bold text-slate-700">Total {enrichedRecords.length} days</span>
            {/* {enrichedRecords.length !== 1 ? 's' : ''} ·{' '}
            <span className="font-bold text-indigo-600 whitespace-nowrap">
              {fmt(paymentTotal)} ৳
            </span>{' '}
            total revenue ·{' '}
            <span
              className={`font-bold whitespace-nowrap ${totals.dailyAvail >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}
            >
              {totals.dailyAvail >= 0 ? '+' : ''}
              {fmt(totals.dailyAvail)} ৳
            </span>{' '}
            day result */}
          </p>

          <div className="w-full md:w-auto">
            <Pagination pagination={pagination} showPageInfo={false} />
          </div>
        </div>
      )}
    </div>
  );
}
