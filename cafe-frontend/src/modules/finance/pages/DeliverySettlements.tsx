import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Bike,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Banknote,
  Smartphone,
  Landmark,
  Vault,
  Search,
  X,
  Trash2,
  Pencil,
  Clock,
  CheckCircle2,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { deliverySettlementsService } from '@/core/api/services';
import type {
  DeliverySettlement,
  DeliveryPlatform,
  SettlementStatus,
} from '@/core/types/deliverySettlement.types';
import type { FundAccountType } from '@/core/types/fund.types';
import { ManagerPasswordModal, ButtonLoading, Pagination } from '@/shared/components/ui';
import { useClientPagination, useCanMutate } from '@/shared/hooks';
import { handleError, formatCurrency, formatDate, todayBusinessKey } from '@/shared/utils';
import { ExportDropdown } from '@/shared/export';
import type { ColDef } from '@/shared/export';
import { useERPActions } from '@/core/context/useERPActions';
// ─── Config ───────────────────────────────────────────────────────────────────
const PLATFORM_CONFIG: Record<DeliveryPlatform, { label: string; color: string; bg: string }> = {
  foodpanda: { label: 'Foodpanda', color: 'text-pink-600', bg: 'bg-pink-50 border-pink-100' },
  foodi: { label: 'Foodi', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
  other: { label: 'Other', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
};
const STATUS_CONFIG: Record<
  SettlementStatus,
  { label: string; color: string; bg: string; icon: LucideIcon }
> = {
  pending: {
    label: 'Pending',
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
    icon: Clock,
  },
  received: {
    label: 'Received',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
    icon: CheckCircle2,
  },
  disputed: {
    label: 'Disputed',
    color: 'text-rose-700',
    bg: 'bg-rose-50 border-rose-200',
    icon: AlertTriangle,
  },
};
const ACCOUNT_CONFIG: Record<FundAccountType, { label: string; icon: LucideIcon; color: string }> =
  {
    cash: { label: 'Cash Drawer', icon: Banknote, color: 'text-emerald-600' },
    bank: { label: 'Bank Account', icon: Landmark, color: 'text-blue-600' },
    bkash: { label: 'bKash Wallet', icon: Smartphone, color: 'text-pink-600' },
    reserve: { label: 'Reserve Fund', icon: Vault, color: 'text-purple-600' },
  };
// ─── Form schema ──────────────────────────────────────────────────────────────
const settlementFormSchema = z
  .object({
    platform: z.enum(['foodpanda', 'foodi', 'other']),
    platformOther: z.string().optional(),
    settlementNumber: z.string().optional(),
    periodStart: z.string().min(1, 'Required'),
    periodEnd: z.string().min(1, 'Required'),
    invoiceDate: z.string().min(1, 'Required'),
    grossAmount: z
      .string()
      .min(1, 'Required')
      .refine((v) => !isNaN(Number(v)) && Number(v) >= 0, 'Must be ≥ 0'),
    commissionAmount: z
      .string()
      .optional()
      .refine((v) => !v || (!isNaN(Number(v)) && Number(v) >= 0), 'Must be ≥ 0'),
    vatOnService: z
      .string()
      .optional()
      .refine((v) => !v || (!isNaN(Number(v)) && Number(v) >= 0), 'Must be ≥ 0'),
    status: z.enum(['pending', 'received', 'disputed']),
    netAmountReceived: z.string().optional(),
    receivedDate: z.string().optional(),
    bankAccount: z.string().optional(),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.platform === 'other' && !data.platformOther?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Platform name is required',
        path: ['platformOther'],
      });
    }
    if (new Date(data.periodEnd) < new Date(data.periodStart)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Must be on/after period start',
        path: ['periodEnd'],
      });
    }
    if (data.status === 'received') {
      if (!data.netAmountReceived || isNaN(Number(data.netAmountReceived))) {
        ctx.addIssue({
          code: 'custom',
          message: 'Received amount is required',
          path: ['netAmountReceived'],
        });
      }
      if (!data.bankAccount) {
        ctx.addIssue({
          code: 'custom',
          message: 'Deposit account is required',
          path: ['bankAccount'],
        });
      }
    }
  });
type SettlementFormData = z.infer<typeof settlementFormSchema>;
const EMPTY_FORM: SettlementFormData = {
  platform: 'foodpanda',
  platformOther: '',
  settlementNumber: '',
  periodStart: todayBusinessKey(),
  periodEnd: todayBusinessKey(),
  invoiceDate: todayBusinessKey(),
  grossAmount: '',
  commissionAmount: '',
  vatOnService: '',
  status: 'pending',
  netAmountReceived: '',
  receivedDate: todayBusinessKey(),
  bankAccount: '',
  notes: '',
};
// ─── Small shared UI bits ─────────────────────────────────────────────────────
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
    <div className="flex items-center justify-between sm:justify-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1.5 shadow-sm w-full sm:w-auto">
      <button
        type="button"
        onClick={onPrev}
        aria-label="Previous month"
        className="p-2 sm:p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="text-sm font-bold text-slate-700 min-w-[130px] text-center select-none px-2">
        {label}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={disableNext}
        aria-label="Next month"
        className="p-2 sm:p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
function PlatformBadge({
  platform,
  platformOther,
}: {
  platform: DeliveryPlatform;
  platformOther?: string;
}) {
  const cfg = PLATFORM_CONFIG[platform];
  const label = platform === 'other' ? platformOther?.trim() || 'Other' : cfg.label;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md whitespace-nowrap border ${cfg.bg} ${cfg.color}`}
    >
      <Bike size={12} />
      {label}
    </span>
  );
}
function StatusBadge({ status }: { status: SettlementStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md whitespace-nowrap border ${cfg.bg} ${cfg.color}`}
    >
      <Icon size={12} />
      {cfg.label}
    </span>
  );
}
// ─── Main Component ───────────────────────────────────────────────────────────
export default function DeliverySettlements() {
  const canMutate = useCanMutate();
  const { refreshTransactions } = useERPActions();
  const [settlements, setSettlements] = useState<DeliverySettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const loadSettlements = useCallback(async () => {
    try {
      const rows = await deliverySettlementsService.getAll();
      setSettlements(rows);
    } catch (error) {
      handleError(error, { action: 'load_delivery_settlements', severity: 'medium' });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadSettlements();
  }, [loadSettlements]);
  const now = new Date();
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
  // ── UI state ──
  const [formOpen, setFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<DeliveryPlatform | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<SettlementStatus | 'all'>('all');
  const formDialogRef = useRef<HTMLDialogElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void | Promise<void>) | null>(null);
  const {
    register,
    handleSubmit: handleFormSubmit,
    formState: { errors, isSubmitting },
    reset,
    control,
  } = useForm<SettlementFormData>({
    resolver: zodResolver(settlementFormSchema),
    defaultValues: EMPTY_FORM,
  });
  const watchPlatform = useWatch({ control, name: 'platform' });
  const watchStatus = useWatch({ control, name: 'status' });
  const watchBankAccount = useWatch({ control, name: 'bankAccount' });
  const watchGross = useWatch({ control, name: 'grossAmount' });
  const watchCommission = useWatch({ control, name: 'commissionAmount' });
  const watchDeductions = useWatch({ control, name: 'vatOnService' });
  const livePreviewNet = useMemo(() => {
    const gross = Number(watchGross) || 0;
    const commission = Number(watchCommission) || 0;
    const deductions = Number(watchDeductions) || 0;
    return Math.max(0, gross - commission - deductions);
  }, [watchGross, watchCommission, watchDeductions]);
  // ── Derived data ──
  const monthSettlements = useMemo(
    () =>
      settlements.filter(
        (s) =>
          s.invoiceDate.getFullYear() === selectedMonth.year &&
          s.invoiceDate.getMonth() === selectedMonth.month
      ),
    [settlements, selectedMonth]
  );
  const filteredSettlements = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return monthSettlements.filter(
      (s) =>
        (platformFilter === 'all' || s.platform === platformFilter) &&
        (statusFilter === 'all' || s.status === statusFilter) &&
        (!q ||
          (s.settlementNumber ?? '').toLowerCase().includes(q) ||
          (s.platformOther ?? '').toLowerCase().includes(q) ||
          PLATFORM_CONFIG[s.platform].label.toLowerCase().includes(q) ||
          (s.notes ?? '').toLowerCase().includes(q))
    );
  }, [monthSettlements, searchQuery, platformFilter, statusFilter]);
  const { paginatedData, pagination } = useClientPagination(filteredSettlements, {
    initialPageSize: 10,
    pageSizeOptions: [10, 20, 50],
  });
  const summary = useMemo(() => {
    const pendingReceivable = settlements
      .filter((s) => s.status === 'pending')
      .reduce((sum, s) => sum + s.netAmount, 0);
    const receivedThisMonth = settlements
      .filter(
        (s) =>
          s.status === 'received' &&
          s.receivedDate &&
          s.receivedDate.getFullYear() === selectedMonth.year &&
          s.receivedDate.getMonth() === selectedMonth.month
      )
      .reduce((sum, s) => sum + (s.netAmountReceived ?? 0), 0);
    const grossThisMonth = monthSettlements.reduce((sum, s) => sum + s.grossAmount, 0);
    const platformCounts = monthSettlements.reduce(
      (acc, s) => {
        acc[s.platform] = (acc[s.platform] ?? 0) + 1;
        return acc;
      },
      {} as Record<DeliveryPlatform, number>
    );
    const topPlatform = (Object.entries(platformCounts) as [DeliveryPlatform, number][]).sort(
      (a, b) => b[1] - a[1]
    )[0];
    return {
      pendingReceivable,
      receivedThisMonth,
      settlementsThisMonth: monthSettlements.length,
      grossThisMonth,
      topPlatform: topPlatform ? PLATFORM_CONFIG[topPlatform[0]].label : '—',
    };
  }, [settlements, monthSettlements, selectedMonth]);
  // ── Handlers ──
  const startEdit = useCallback(
    (settlement: DeliverySettlement) => {
      setEditingId(settlement.id);
      reset({
        platform: settlement.platform,
        platformOther: settlement.platformOther ?? '',
        settlementNumber: settlement.settlementNumber ?? '',
        periodStart: settlement.periodStart.toISOString().slice(0, 10),
        periodEnd: settlement.periodEnd.toISOString().slice(0, 10),
        invoiceDate: settlement.invoiceDate.toISOString().slice(0, 10),
        grossAmount: String(settlement.grossAmount),
        commissionAmount: settlement.commissionAmount ? String(settlement.commissionAmount) : '',
        vatOnService: settlement.vatOnService ? String(settlement.vatOnService) : '',
        status: settlement.status,
        netAmountReceived:
          settlement.netAmountReceived !== undefined ? String(settlement.netAmountReceived) : '',
        receivedDate: settlement.receivedDate
          ? settlement.receivedDate.toISOString().slice(0, 10)
          : todayBusinessKey(),
        bankAccount: settlement.bankAccount ?? '',
        notes: settlement.notes ?? '',
      });
      setFormOpen(true);
    },
    [reset]
  );
  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setFormOpen(false);
    reset(EMPTY_FORM);
  }, [reset]);
  const onSubmit = useCallback(
    async (data: SettlementFormData) => {
      const payload = {
        platform: data.platform,
        platformOther: data.platform === 'other' ? data.platformOther?.trim() : undefined,
        settlementNumber: data.settlementNumber?.trim() || undefined,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        invoiceDate: data.invoiceDate,
        grossAmount: Number(data.grossAmount),
        commissionAmount: data.commissionAmount ? Number(data.commissionAmount) : 0,
        vatOnService: data.vatOnService ? Number(data.vatOnService) : 0,
        status: data.status,
        netAmountReceived:
          data.status === 'received' && data.netAmountReceived
            ? Number(data.netAmountReceived)
            : undefined,
        receivedDate: data.status === 'received' ? data.receivedDate : undefined,
        bankAccount:
          data.status === 'received' && data.bankAccount
            ? (data.bankAccount as FundAccountType)
            : undefined,
        notes: data.notes?.trim() || undefined,
      };
      try {
        if (editingId) {
          await deliverySettlementsService.update(editingId, payload);
          toast.success('Payout updated');
        } else {
          await deliverySettlementsService.create(payload);
          toast.success('Payout recorded');
        }
        await loadSettlements();
        void refreshTransactions({ silent: true });
        cancelEdit();
      } catch (error) {
        handleError(error, { action: 'save_delivery_settlement', severity: 'high' });
      }
    },
    [editingId, loadSettlements, cancelEdit, refreshTransactions]
  );
  const requestDelete = useCallback(
    (settlement: DeliverySettlement) => {
      setPendingAction(() => async () => {
        try {
          await deliverySettlementsService.delete(settlement.id);
          if (editingId === settlement.id) cancelEdit();
          await loadSettlements();
          void refreshTransactions({ silent: true });
          toast.success('Payout deleted');
        } catch (error) {
          handleError(error, { action: 'delete_delivery_settlement', severity: 'high' });
        }
      });
      setPasswordModalOpen(true);
    },
    [editingId, cancelEdit, loadSettlements, refreshTransactions]
  );
  // ── Export ──
  const exportConfig = useMemo(
    () => ({
      filenameBase: `delivery_settlements_${selectedMonth.year}_${selectedMonth.month + 1}`,
      title: 'Delivery Payouts',
      subtitle: monthLabel,
      columns: [
        {
          header: 'Invoice Date',
          accessor: (row: DeliverySettlement) => formatDate(row.invoiceDate),
        },
        {
          header: 'Platform',
          accessor: (row: DeliverySettlement) =>
            row.platform === 'other'
              ? row.platformOther || 'Other'
              : PLATFORM_CONFIG[row.platform].label,
        },
        {
          header: 'Payout #',
          accessor: (row: DeliverySettlement) => row.settlementNumber ?? '',
        },
        {
          header: 'Period',
          accessor: (row: DeliverySettlement) =>
            `${formatDate(row.periodStart)} – ${formatDate(row.periodEnd)}`,
        },
        {
          header: 'Gross',
          accessor: 'grossAmount' as const,
          format: (v: string | number | null | undefined) => Number(v).toFixed(2),
        },
        {
          header: 'Commission',
          accessor: 'commissionAmount' as const,
          format: (v: string | number | null | undefined) => Number(v).toFixed(2),
        },
        {
          header: 'Net Amount',
          accessor: 'netAmount' as const,
          format: (v: string | number | null | undefined) => Number(v).toFixed(2),
        },
        { header: 'Status', accessor: 'status' as const },
        { header: 'Notes', accessor: 'notes' as const },
      ] satisfies ColDef<DeliverySettlement>[],
      sheetName: 'Payouts',
      getData: () => filteredSettlements,
    }),
    [filteredSettlements, monthLabel, selectedMonth]
  );

  useEffect(() => {
    if (!formOpen || !canMutate) return;
    const dialog = formDialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [formOpen, canMutate]);

  const openCreate = () => {
    if (!canMutate) return;
    setEditingId(null);
    reset({
      ...EMPTY_FORM,
      periodStart: todayBusinessKey(),
      periodEnd: todayBusinessKey(),
      invoiceDate: todayBusinessKey(),
      receivedDate: todayBusinessKey(),
    });
    setFormOpen(true);
  };
  const clearFilters = () => {
    setSearchQuery('');
    setPlatformFilter('all');
    setStatusFilter('all');
  };
  const hasFilters = Boolean(
    searchQuery.trim() || platformFilter !== 'all' || statusFilter !== 'all'
  );

  return (
    <div className="min-w-0 space-y-4 text-slate-700">
      <ManagerPasswordModal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        onConfirm={() => {
          void pendingAction?.();
          setPasswordModalOpen(false);
        }}
        title="Delete Payout"
        requiredRole="owner"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Payout overview</h2>
          <p className="mt-1 text-sm text-erp-secondary">
            Track platform statements, deductions, and deposits.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthNavigator
            label={monthLabel}
            onPrev={goToPrevMonth}
            onNext={goToNextMonth}
            disableNext={isCurrentMonth}
          />
          {canMutate && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
            >
              <Plus size={17} /> Record Payout
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          {
            label: 'Pending receivable',
            value: formatCurrency(summary.pendingReceivable),
            note: 'All periods · pending only',
            color: 'text-amber-700',
          },
          {
            label: 'Received',
            value: formatCurrency(summary.receivedThisMonth),
            note: `By deposit date · ${monthLabel}`,
            color: 'text-emerald-700',
          },
          {
            label: 'Statements',
            value: String(summary.settlementsThisMonth),
            note: `By invoice date · ${monthLabel}`,
            color: 'text-slate-900',
          },
          {
            label: 'Gross amount',
            value: formatCurrency(summary.grossThisMonth),
            note: `Top platform by count: ${summary.topPlatform}`,
            color: 'text-slate-900',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm"
          >
            <p className="text-xs font-medium text-slate-500">{stat.label}</p>
            <p
              className={`mt-2 break-words text-lg font-bold tabular-nums sm:text-xl ${stat.color}`}
            >
              {loading ? '—' : stat.value}
            </p>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">{stat.note}</p>
          </div>
        ))}
      </div>

      <section
        aria-labelledby="settlement-history-title"
        className="rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div>
            <h3 id="settlement-history-title" className="text-sm font-bold text-slate-900">
              Payout history
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Invoice month: {monthLabel} · {filteredSettlements.length} of{' '}
              {monthSettlements.length} records
            </p>
          </div>
          <ExportDropdown
            config={exportConfig}
            disabled={loading || filteredSettlements.length === 0}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/50 p-4 sm:px-5">
          <div className="relative w-full sm:w-72">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              aria-label="Search settlements"
              placeholder="Search reference, platform or notes…"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
          </div>
          <select
            aria-label="Filter platform"
            value={platformFilter}
            onChange={(event) => setPlatformFilter(event.target.value as DeliveryPlatform | 'all')}
            className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-cyan-200 sm:flex-none"
          >
            <option value="all">All platforms</option>
            <option value="foodpanda">Foodpanda</option>
            <option value="foodi">Foodi</option>
            <option value="other">Other</option>
          </select>
          <select
            aria-label="Filter status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as SettlementStatus | 'all')}
            className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-cyan-200 sm:flex-none"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="received">Received</option>
            <option value="disputed">Disputed</option>
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50"
            >
              <X size={14} /> Clear filters
            </button>
          )}
        </div>
        <p className="px-4 pt-3 text-[11px] text-slate-500 sm:px-5">
          Summary totals follow their stated periods; search and filters apply to history and
          exports.
        </p>
        <div className="max-h-[65dvh] overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
          {loading ? (
            <p role="status" className="px-5 py-12 text-center text-sm text-slate-500">
              Loading settlements…
            </p>
          ) : paginatedData.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-12 text-center">
              <span className="mb-3 rounded-2xl bg-slate-50 p-3 text-slate-400">
                <Bike size={26} />
              </span>
              <h4 className="text-sm font-semibold text-slate-800">
                {hasFilters ? 'No matching payouts' : 'No statements for this month'}
              </h4>
              <p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">
                {hasFilters
                  ? 'Try another search or clear the filters.'
                  : 'Choose another invoice month or record a platform statement.'}
              </p>
              {hasFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold"
                >
                  Clear filters
                </button>
              ) : (
                canMutate && (
                  <button
                    type="button"
                    onClick={openCreate}
                    className="mt-4 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-semibold text-cyan-800"
                  >
                    Record Payout
                  </button>
                )
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {paginatedData.map((settlement) => (
                <li key={settlement.id} className="px-4 py-4 sm:px-5">
                  <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <PlatformBadge
                          platform={settlement.platform}
                          platformOther={settlement.platformOther}
                        />
                        <StatusBadge status={settlement.status} />
                      </div>
                      <p className="mt-2 break-words text-sm font-semibold text-slate-800">
                        {settlement.settlementNumber || 'No invoice reference'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Invoice · {formatDate(settlement.invoiceDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Statement period</p>
                      <p className="mt-1 text-xs font-medium leading-5 text-slate-700">
                        {formatDate(settlement.periodStart)} – {formatDate(settlement.periodEnd)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Net receivable</p>
                      <p className="mt-1 break-words text-base font-bold tabular-nums text-slate-900">
                        {formatCurrency(settlement.netAmount)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Gross {formatCurrency(settlement.grossAmount)}
                      </p>
                    </div>
                    {canMutate && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(settlement)}
                          aria-label={`Edit settlement ${settlement.settlementNumber || formatDate(settlement.invoiceDate)}`}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold hover:bg-cyan-50 focus-visible:ring-2 focus-visible:ring-cyan-500"
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDelete(settlement)}
                          aria-label={`Delete settlement ${settlement.settlementNumber || formatDate(settlement.invoiceDate)}`}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-rose-700 hover:bg-rose-50 focus-visible:ring-2 focus-visible:ring-rose-400"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                  <details className="group mt-3">
                    <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-50 focus-visible:ring-2 focus-visible:ring-cyan-500 [&::-webkit-details-marker]:hidden">
                      View breakdown
                      <ChevronDown
                        size={14}
                        className="transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <dt className="text-slate-500">Commission</dt>
                          <dd className="mt-1 font-semibold tabular-nums">
                            {formatCurrency(settlement.commissionAmount)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">VAT on service</dt>
                          <dd className="mt-1 font-semibold tabular-nums">
                            {formatCurrency(settlement.vatOnService)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Amount received</dt>
                          <dd className="mt-1 font-semibold tabular-nums">
                            {settlement.netAmountReceived == null
                              ? 'Not recorded'
                              : formatCurrency(settlement.netAmountReceived)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Deposit account</dt>
                          <dd className="mt-1 font-semibold">
                            {settlement.bankAccount
                              ? ACCOUNT_CONFIG[settlement.bankAccount].label
                              : 'Not recorded'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Deposit date</dt>
                          <dd className="mt-1 font-semibold">
                            {settlement.receivedDate
                              ? formatDate(settlement.receivedDate)
                              : 'Not recorded'}
                          </dd>
                        </div>
                      </dl>
                      {settlement.notes && (
                        <div className="mt-4 border-t border-slate-200 pt-3">
                          <p className="text-xs font-semibold text-slate-600">Notes</p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">
                            {settlement.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
        {filteredSettlements.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-5">
            <span className="text-xs text-slate-500">{filteredSettlements.length} records</span>
            <Pagination pagination={pagination} showPageInfo={false} />
          </div>
        )}
      </section>

      {formOpen &&
        canMutate &&
        createPortal(
          <dialog
            ref={formDialogRef}
            aria-labelledby="settlement-form-title"
            onCancel={(event) => {
              event.preventDefault();
              if (!isSubmitting) cancelEdit();
            }}
            className="fixed bottom-auto left-auto right-0 top-0 m-0 h-[100dvh] max-h-[100dvh] w-full max-w-xl overflow-hidden border-0 bg-white p-0 text-slate-700 shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm"
          >
            <form
              onSubmit={handleFormSubmit(onSubmit)}
              className="flex h-full min-h-0 w-full flex-col overflow-hidden"
            >
              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                <div>
                  <h2 id="settlement-form-title" className="text-base font-bold text-slate-900">
                    {editingId ? 'Edit Payout' : 'Record Payout'}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Enter the platform statement, then confirm its payment status.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={isSubmitting}
                  aria-label="Close payout form"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </header>
              <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
                <fieldset disabled={isSubmitting} className="min-w-0 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-800">Statement details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className={watchPlatform === 'other' ? 'sm:col-span-1' : 'sm:col-span-2'}>
                      <label
                        htmlFor="settlement-platform"
                        className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block"
                      >
                        Platform
                      </label>
                      <select
                        autoFocus
                        id="settlement-platform"
                        {...register('platform')}
                        className="w-full h-11 pl-3 pr-9 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-medium cursor-pointer"
                      >
                        <option value="foodpanda">Foodpanda</option>
                        <option value="foodi">Foodi</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    {watchPlatform === 'other' && (
                      <div className="sm:col-span-1">
                        <label
                          htmlFor="settlement-platformOther"
                          className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block"
                        >
                          Platform Name
                        </label>
                        <input
                          id="settlement-platformOther"
                          type="text"
                          placeholder="e.g. HungryNaki"
                          {...register('platformOther')}
                          className={`w-full h-11 px-3 bg-white border ${errors.platformOther ? 'border-red-400' : 'border-slate-200'} rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 text-sm`}
                        />
                        {errors.platformOther && (
                          <p className="mt-1 text-xs text-rose-600" role="alert">
                            {errors.platformOther.message}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="settlement-settlementNumber"
                      className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block"
                    >
                      Payout / Invoice No. (optional)
                    </label>
                    <input
                      id="settlement-settlementNumber"
                      type="text"
                      placeholder="e.g. FP-INV-10234"
                      {...register('settlementNumber')}
                      className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="settlement-periodStart"
                        className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block"
                      >
                        Period Start
                      </label>
                      <input
                        id="settlement-periodStart"
                        type="date"
                        {...register('periodStart')}
                        className="w-full h-11 px-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 text-sm cursor-pointer"
                      />
                      {errors.periodStart && (
                        <p className="mt-1 text-xs text-rose-600" role="alert">
                          {errors.periodStart.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label
                        htmlFor="settlement-periodEnd"
                        className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block"
                      >
                        Period End
                      </label>
                      <input
                        id="settlement-periodEnd"
                        type="date"
                        {...register('periodEnd')}
                        className={`w-full h-11 px-2.5 bg-slate-50 border ${errors.periodEnd ? 'border-red-400' : 'border-slate-200'} rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 text-sm cursor-pointer`}
                      />
                      {errors.periodEnd && (
                        <p className="text-xs text-red-600 mt-1">{errors.periodEnd.message}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="settlement-invoiceDate"
                      className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block"
                    >
                      Invoice Date
                    </label>
                    <input
                      id="settlement-invoiceDate"
                      type="date"
                      {...register('invoiceDate')}
                      className="w-full h-11 px-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 text-sm cursor-pointer"
                    />
                    {errors.invoiceDate && (
                      <p className="mt-1 text-xs text-rose-600" role="alert">
                        {errors.invoiceDate.message}
                      </p>
                    )}
                  </div>
                  <h3 className="border-t border-slate-100 pt-5 text-sm font-semibold text-slate-800">
                    Amounts &amp; deductions
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="settlement-grossAmount"
                        className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block"
                      >
                        Gross Amount (৳)
                      </label>
                      <input
                        id="settlement-grossAmount"
                        type="number"
                        step="any"
                        placeholder="0.00"
                        {...register('grossAmount')}
                        className={`w-full h-11 px-3 bg-white border ${errors.grossAmount ? 'border-red-400' : 'border-slate-200'} rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 font-bold text-slate-800 text-sm`}
                      />
                      {errors.grossAmount && (
                        <p className="text-xs text-red-600 mt-1">{errors.grossAmount.message}</p>
                      )}
                    </div>
                    <div>
                      <label
                        htmlFor="settlement-commissionAmount"
                        className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block"
                      >
                        Commission (৳)
                      </label>
                      <input
                        id="settlement-commissionAmount"
                        type="number"
                        step="any"
                        placeholder="0.00"
                        {...register('commissionAmount')}
                        className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                      />
                      {errors.commissionAmount && (
                        <p className="mt-1 text-xs text-rose-600" role="alert">
                          {errors.commissionAmount.message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="settlement-vatOnService"
                      className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block"
                    >
                      VAT on Service (৳)
                    </label>
                    <input
                      id="settlement-vatOnService"
                      type="number"
                      step="any"
                      placeholder="0.00"
                      {...register('vatOnService')}
                      className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    />
                    {errors.vatOnService && (
                      <p className="mt-1 text-xs text-rose-600" role="alert">
                        {errors.vatOnService.message}
                      </p>
                    )}
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Net Receivable
                    </span>
                    <span className="text-lg font-extrabold text-slate-800 tabular-nums">
                      {formatCurrency(livePreviewNet)}
                    </span>
                  </div>
                  <h3 className="border-t border-slate-100 pt-5 text-sm font-semibold text-slate-800">
                    Payment status
                  </h3>
                  <div>
                    <label
                      htmlFor="settlement-status"
                      className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block"
                    >
                      Status
                    </label>
                    <select
                      id="settlement-status"
                      {...register('status')}
                      className="w-full h-11 pl-3 pr-9 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-medium cursor-pointer"
                    >
                      <option value="pending">Pending — not yet deposited</option>
                      <option value="received">Received — deposit confirmed</option>
                      <option value="disputed">Disputed</option>
                    </select>
                  </div>
                  {watchStatus === 'received' && (
                    <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label
                            htmlFor="settlement-netAmountReceived"
                            className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block"
                          >
                            Amount Received (৳)
                          </label>
                          <input
                            id="settlement-netAmountReceived"
                            type="number"
                            step="any"
                            placeholder="0.00"
                            {...register('netAmountReceived')}
                            className={`w-full h-11 px-3 bg-white border ${errors.netAmountReceived ? 'border-red-400' : 'border-slate-200'} rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-sm`}
                          />
                          {errors.netAmountReceived && (
                            <p className="text-xs text-red-600 mt-1">
                              {errors.netAmountReceived.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <label
                            htmlFor="settlement-receivedDate"
                            className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block"
                          >
                            Deposit Date
                          </label>
                          <input
                            id="settlement-receivedDate"
                            type="date"
                            {...register('receivedDate')}
                            className="w-full h-11 px-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm cursor-pointer"
                          />
                        </div>
                      </div>
                      <div>
                        <label
                          htmlFor="settlement-bankAccount"
                          className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block"
                        >
                          Deposit Account
                        </label>
                        <select
                          id="settlement-bankAccount"
                          {...register('bankAccount')}
                          className={`w-full h-11 pl-3 pr-9 bg-white border ${errors.bankAccount ? 'border-red-400' : 'border-slate-200'} rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm cursor-pointer`}
                        >
                          <option value="">Select...</option>
                          {Object.entries(ACCOUNT_CONFIG).map(([key, cfg]) => (
                            <option key={key} value={key}>
                              {cfg.label}
                            </option>
                          ))}
                        </select>
                        {errors.bankAccount && (
                          <p className="text-xs text-red-600 mt-1">{errors.bankAccount.message}</p>
                        )}
                      </div>
                      {watchBankAccount === 'reserve' ? (
                        <p className="text-[11px] text-amber-700 leading-relaxed">
                          Reserve Fund is an internal savings account, not a sales payment method —
                          this deposit updates the Reserve balance only and will{' '}
                          <strong>not</strong> appear in Dashboard sales totals, Reports, or Order
                          History. Pick Cash / Bank / bKash if you want this settlement counted as
                          revenue.
                        </p>
                      ) : (
                        <p className="text-[11px] text-emerald-700 leading-relaxed">
                          Recording this posts one sale for the <strong>net received</strong> amount
                          (Foodpanda/Foodi channel, deposit method). That is separate from New Order
                          Delivery tickets — those are itemised POS orders. Do not ring the same
                          platform invoice on New Order if you are recording it here, or the channel
                          total would be counted twice.
                        </p>
                      )}
                    </div>
                  )}
                  <div>
                    <label
                      htmlFor="settlement-notes"
                      className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block"
                    >
                      Notes
                    </label>
                    <textarea
                      id="settlement-notes"
                      rows={3}
                      placeholder="Optional details..."
                      {...register('notes')}
                      className="w-full min-h-[88px] resize-y px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    />
                  </div>
                </fieldset>
              </div>
              <footer className="flex shrink-0 flex-wrap items-center gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="mr-auto">
                  <p className="text-[11px] text-slate-500">Net receivable</p>
                  <p className="text-sm font-bold tabular-nums">{formatCurrency(livePreviewNet)}</p>
                </div>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={isSubmitting}
                  className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <ButtonLoading
                  loading={isSubmitting}
                  type="submit"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-700 px-4 text-sm font-semibold text-white hover:bg-cyan-800"
                >
                  {editingId ? 'Save Changes' : 'Save Payout'}
                </ButtonLoading>
              </footer>
            </form>
          </dialog>,
          document.body
        )}
    </div>
  );
}
