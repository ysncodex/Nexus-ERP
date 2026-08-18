import { useState, useMemo, useCallback, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Bike,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
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
  Wallet,
  Package2,
  type LucideIcon,
} from 'lucide-react';
import { deliverySettlementsService } from '@/core/api/services';
import type {
  DeliverySettlement,
  DeliveryPlatform,
  SettlementStatus,
} from '@/core/types/deliverySettlement.types';
import type { FundAccountType } from '@/core/types/fund.types';
import {
  ManagerPasswordModal,
  ButtonLoading,
  Pagination,
  StatCard,
} from '@/shared/components/ui';
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
  pending: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Clock },
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

const ACCOUNT_CONFIG: Record<FundAccountType, { label: string; icon: LucideIcon; color: string }> = {
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
      ctx.addIssue({ code: 'custom', message: 'Platform name is required', path: ['platformOther'] });
    }
    if (new Date(data.periodEnd) < new Date(data.periodStart)) {
      ctx.addIssue({ code: 'custom', message: 'Must be on/after period start', path: ['periodEnd'] });
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
        ctx.addIssue({ code: 'custom', message: 'Deposit account is required', path: ['bankAccount'] });
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

function PlatformBadge({ platform, platformOther }: { platform: DeliveryPlatform; platformOther?: string }) {
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
      prev.month === 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: prev.month - 1 }
    );
  const goToNextMonth = () =>
    setSelectedMonth((prev) =>
      prev.month === 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: prev.month + 1 }
    );

  // ── UI state ──
  const [showMobileForm, setShowMobileForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
    if (!searchQuery.trim()) return monthSettlements;
    const q = searchQuery.toLowerCase();
    return monthSettlements.filter(
      (s) =>
        (s.settlementNumber ?? '').toLowerCase().includes(q) ||
        (s.platformOther ?? '').toLowerCase().includes(q) ||
        PLATFORM_CONFIG[s.platform].label.toLowerCase().includes(q) ||
        s.notes.toLowerCase().includes(q)
    );
  }, [monthSettlements, searchQuery]);

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
      if (window.innerWidth < 1024) setShowMobileForm(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [reset]
  );

  const cancelEdit = useCallback(() => {
    setEditingId(null);
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
          toast.success('Settlement updated');
        } else {
          await deliverySettlementsService.create(payload);
          toast.success('Settlement recorded');
        }
        await loadSettlements();
        void refreshTransactions({ silent: true });
        cancelEdit();
        if (window.innerWidth < 1024) setShowMobileForm(false);
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
          toast.success('Settlement deleted');
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
      title: 'Delivery Platform Settlements',
      subtitle: monthLabel,
      columns: [
        {
          header: 'Invoice Date',
          accessor: (row: DeliverySettlement) => formatDate(row.invoiceDate),
        },
        {
          header: 'Platform',
          accessor: (row: DeliverySettlement) =>
            row.platform === 'other' ? row.platformOther || 'Other' : PLATFORM_CONFIG[row.platform].label,
        },
        { header: 'Settlement #', accessor: (row: DeliverySettlement) => row.settlementNumber ?? '' },
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
      sheetName: 'Settlements',
      getData: () => filteredSettlements,
    }),
    [filteredSettlements, monthLabel, selectedMonth]
  );

  // ── Render ──

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 sm:gap-6 animate-in fade-in zoom-in-95 duration-300 pb-20 sm:pb-0">
      <ManagerPasswordModal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        onConfirm={() => {
          void pendingAction?.();
          setPasswordModalOpen(false);
        }}
        title="Delete Settlement"
        requiredRole="owner"
      />

      {/* ── Form Panel ── */}
      <div className="bg-white/90 backdrop-blur p-4 sm:p-5 lg:p-6 rounded-2xl shadow-sm border border-slate-200 h-fit lg:sticky lg:top-28 transition-all">
        <div
          className={`flex items-start justify-between gap-3 cursor-pointer lg:cursor-default ${
            showMobileForm
              ? 'mb-5 pb-5 border-b border-slate-100'
              : 'mb-0 pb-0 border-transparent lg:mb-5 lg:pb-5 lg:border-slate-100 border-b'
          }`}
          onClick={() => window.innerWidth < 1024 && setShowMobileForm(!showMobileForm)}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-pink-50 border border-pink-100 text-pink-600 shrink-0">
              <Bike size={20} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-800 leading-tight">
                {editingId ? 'Edit Settlement' : 'Record Settlement'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Foodpanda / Foodi income</p>
            </div>
          </div>
          <div className="flex items-center shrink-0 lg:hidden">
            <div className="p-2 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center border border-slate-100">
              {showMobileForm ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>
        </div>

        <div
          className={`lg:block ${showMobileForm ? 'block animate-in slide-in-from-top-2 fade-in duration-200' : 'hidden'}`}
        >
          {canMutate && (
            <form onSubmit={handleFormSubmit(onSubmit)} className="space-y-4 sm:space-y-5">
              {editingId && (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                  <span className="text-xs font-semibold text-blue-700">Editing settlement</span>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="text-xs font-bold text-blue-700 hover:text-blue-900 underline"
                  >
                    Cancel
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className={watchPlatform === 'other' ? 'col-span-1' : 'col-span-2'}>
                  <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block">
                    Platform
                  </label>
                  <select
                    {...register('platform')}
                    className="w-full h-11 pl-3 pr-9 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 appearance-none text-sm font-medium cursor-pointer"
                  >
                    <option value="foodpanda">Foodpanda</option>
                    <option value="foodi">Foodi</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                {watchPlatform === 'other' && (
                  <div className="col-span-1">
                    <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block">
                      Platform Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. HungryNaki"
                      {...register('platformOther')}
                      className={`w-full h-11 px-3 bg-white border ${errors.platformOther ? 'border-red-400' : 'border-slate-200'} rounded-xl outline-none focus:ring-2 focus:ring-pink-500 text-sm`}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block">
                  Settlement / Invoice No. (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. FP-INV-10234"
                  {...register('settlementNumber')}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block">
                    Period Start
                  </label>
                  <input
                    type="date"
                    {...register('periodStart')}
                    className="w-full h-11 px-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 text-sm cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block">
                    Period End
                  </label>
                  <input
                    type="date"
                    {...register('periodEnd')}
                    className={`w-full h-11 px-2.5 bg-slate-50 border ${errors.periodEnd ? 'border-red-400' : 'border-slate-200'} rounded-xl outline-none focus:ring-2 focus:ring-pink-500 text-sm cursor-pointer`}
                  />
                  {errors.periodEnd && (
                    <p className="text-xs text-red-600 mt-1">{errors.periodEnd.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block">
                  Invoice Date
                </label>
                <input
                  type="date"
                  {...register('invoiceDate')}
                  className="w-full h-11 px-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 text-sm cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block">
                    Gross Amount (৳)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    {...register('grossAmount')}
                    className={`w-full h-11 px-3 bg-white border ${errors.grossAmount ? 'border-red-400' : 'border-slate-200'} rounded-xl outline-none focus:ring-2 focus:ring-pink-500 font-bold text-slate-800 text-sm`}
                  />
                  {errors.grossAmount && (
                    <p className="text-xs text-red-600 mt-1">{errors.grossAmount.message}</p>
                  )}
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block">
                    Commission (৳)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    {...register('commissionAmount')}
                    className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block">
                  VAT on Service (৳)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  {...register('vatOnService')}
                  className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Net Receivable
                </span>
                <span className="text-lg font-extrabold text-slate-800 tabular-nums">
                  {formatCurrency(livePreviewNet)}
                </span>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block">
                  Status
                </label>
                <select
                  {...register('status')}
                  className="w-full h-11 pl-3 pr-9 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 appearance-none text-sm font-medium cursor-pointer"
                >
                  <option value="pending">Pending — not yet deposited</option>
                  <option value="received">Received — deposit confirmed</option>
                  <option value="disputed">Disputed</option>
                </select>
              </div>

              {watchStatus === 'received' && (
                <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block">
                        Amount Received (৳)
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        {...register('netAmountReceived')}
                        className={`w-full h-11 px-3 bg-white border ${errors.netAmountReceived ? 'border-red-400' : 'border-slate-200'} rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-sm`}
                      />
                      {errors.netAmountReceived && (
                        <p className="text-xs text-red-600 mt-1">{errors.netAmountReceived.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block">
                        Deposit Date
                      </label>
                      <input
                        type="date"
                        {...register('receivedDate')}
                        className="w-full h-11 px-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm cursor-pointer"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block">
                      Deposit Account
                    </label>
                    <select
                      {...register('bankAccount')}
                      className={`w-full h-11 pl-3 pr-9 bg-white border ${errors.bankAccount ? 'border-red-400' : 'border-slate-200'} rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 appearance-none text-sm cursor-pointer`}
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
                      Reserve Fund is an internal savings account, not a sales payment method — this
                      deposit updates the Reserve balance only and will <strong>not</strong> appear in
                      Dashboard sales totals, Reports, or Order History. Pick Cash / Bank / bKash if you
                      want this settlement counted as revenue.
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
                <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional details..."
                  {...register('notes')}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                />
              </div>

              <ButtonLoading
                loading={isSubmitting}
                type="submit"
                className="w-full min-h-[48px] px-4 py-3.5 text-white rounded-xl font-bold shadow-md shadow-pink-200 mt-2 bg-pink-600 hover:bg-pink-700 flex items-center justify-center whitespace-nowrap transition-transform active:scale-[0.99]"
              >
                {editingId ? 'Update Settlement' : 'Save Settlement'}
              </ButtonLoading>
            </form>
          )}
        </div>
      </div>

      {/* ── Summary & History Panel ── */}
      <div className="lg:col-span-2 space-y-4 sm:space-y-5">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 md:p-6 bg-gradient-to-r from-pink-50 via-white to-slate-50 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2 sm:p-2.5 bg-pink-100 rounded-lg sm:rounded-xl text-pink-600 shadow-sm shrink-0">
                  <Bike size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">
                    Delivery Platform Settlements
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                    Foodpanda / Foodi income reconciliation
                  </p>
                </div>
              </div>
              <div className="w-full sm:w-auto">
                <MonthNavigator
                  label={monthLabel}
                  onPrev={goToPrevMonth}
                  onNext={goToNextMonth}
                  disableNext={isCurrentMonth}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                title="Pending Receivable"
                value={formatCurrency(summary.pendingReceivable)}
                subtext="Across all periods"
                icon={Clock}
                colorClass="text-amber-600"
                bgClass="bg-amber-50"
              />
              <StatCard
                title="Received This Month"
                value={formatCurrency(summary.receivedThisMonth)}
                subtext="Deposited to accounts"
                icon={Wallet}
                colorClass="text-emerald-600"
                bgClass="bg-emerald-50"
              />
              <StatCard
                title="Settlements"
                value={String(summary.settlementsThisMonth)}
                subtext={monthLabel}
                icon={Package2}
                colorClass="text-blue-600"
                bgClass="bg-blue-50"
              />
              <StatCard
                title="Top Platform"
                value={summary.topPlatform}
                subtext={`Gross ${formatCurrency(summary.grossThisMonth)}`}
                icon={Bike}
                colorClass="text-pink-600"
                bgClass="bg-pink-50"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 md:px-6 py-4 bg-slate-50/60 border-b border-slate-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="relative w-full sm:max-w-xs">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search settlements..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-9 py-2.5 sm:py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-300 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="flex w-full sm:w-auto justify-end">
                <ExportDropdown config={exportConfig} disabled={filteredSettlements.length === 0} />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px] scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
            <table className="w-full text-left min-w-[820px]">
              <thead className="bg-slate-50 border-b-2 border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 sm:px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Invoice Date
                  </th>
                  <th className="px-4 sm:px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Platform
                  </th>
                  <th className="px-4 sm:px-5 py-3.5 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Gross
                  </th>
                  <th className="px-4 sm:px-5 py-3.5 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Net Amount
                  </th>
                  <th className="px-4 sm:px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 sm:px-5 py-3.5 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-sm text-slate-400">
                      Loading settlements…
                    </td>
                  </tr>
                ) : paginatedData.length > 0 ? (
                  paginatedData.map((settlement) => (
                    <tr key={settlement.id} className="hover:bg-pink-50/40 transition-colors group">
                      <td className="px-4 sm:px-5 py-3.5 text-xs font-medium text-slate-600 whitespace-nowrap">
                        {formatDate(settlement.invoiceDate)}
                      </td>
                      <td className="px-4 sm:px-5 py-3.5">
                        <PlatformBadge platform={settlement.platform} platformOther={settlement.platformOther} />
                        {settlement.settlementNumber && (
                          <p className="text-[10px] text-slate-400 mt-1">#{settlement.settlementNumber}</p>
                        )}
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 text-right text-xs font-semibold text-slate-600 tabular-nums">
                        {formatCurrency(settlement.grossAmount)}
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 text-right">
                        <span className="text-sm font-extrabold text-slate-800 tabular-nums">
                          {formatCurrency(settlement.netAmount)}
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3.5">
                        <StatusBadge status={settlement.status} />
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 text-right">
                        {canMutate && (
                          <div className="flex gap-1.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity justify-end">
                            <button
                              onClick={() => startEdit(settlement)}
                              className="p-2 sm:p-1.5 text-slate-400 hover:text-pink-600 hover:bg-pink-50 bg-slate-50 lg:bg-transparent rounded-lg transition-colors"
                              title="Edit Settlement"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => requestDelete(settlement)}
                              className="p-2 sm:p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 bg-slate-50 lg:bg-transparent rounded-lg transition-colors"
                              title="Delete Settlement"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 sm:py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <Bike size={28} className="text-slate-300" />
                        </div>
                        <p className="text-sm font-semibold text-slate-600">No settlements found</p>
                        <p className="text-xs text-slate-400">
                          Record a platform statement using the form to get started.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredSettlements.length > 0 && (
            <div className="px-4 sm:px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-xs text-slate-500 w-full text-center md:text-left">
                <span className="font-bold text-slate-700">{filteredSettlements.length}</span> record
                {filteredSettlements.length !== 1 ? 's' : ''}
              </p>
              <div className="w-full md:w-auto">
                <Pagination pagination={pagination} showPageInfo={false} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
