import { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Wallet,
  ArrowRightLeft,
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronLeft,
  ChevronRight,
  Banknote,
  Smartphone,
  Landmark,
  Vault,
  Search,
  Eye,
  X,
  Trash2,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { useERP } from '@/core/context/useERP';
import { fundsService } from '@/core/api/services';
import type { FundAccountType, FundMovement } from '@/core/types/fund.types';
import { ManagerPasswordModal, Pagination } from '@/shared/components/ui';
import { useClientPagination, useCanMutate } from '@/shared/hooks';
import { handleError, formatCurrency, formatDate } from '@/shared/utils';
import { ExportDropdown } from '@/shared/export';
import type { ColDef } from '@/shared/export';

const MOVEMENT_TYPE_LABELS: Record<FundMovement['movementType'], string> = {
  transfer: 'Fund Transfer',
  add: 'Funds Added',
  withdraw: 'Funds Withdrawn',
  opening: 'Opening Balance',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Constants & Config ───────────────────────────────────────────────────────

const ACCOUNT_CONFIG: Record<
  string,
  { label: string; icon: LucideIcon; color: string; bg: string; border: string }
> = {
  cash: {
    label: 'Cash Drawer',
    icon: Banknote,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
  },
  bank: {
    label: 'Bank Account',
    icon: Landmark,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
  },
  bkash: {
    label: 'bKash Wallet',
    icon: Smartphone,
    color: 'text-pink-600',
    bg: 'bg-pink-50',
    border: 'border-pink-100',
  },
  reserve: {
    label: 'Reserve Fund',
    icon: Vault,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-100',
  },
  external: {
    label: 'External / Owner',
    icon: Wallet,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-100',
  },
};

const MOVEMENT_TYPES = [
  { value: 'transfer', label: 'Transfer Between Accounts', icon: ArrowRightLeft },
  { value: 'add', label: 'Add Funds', icon: ArrowDownToLine },
  { value: 'withdraw', label: 'Withdraw Funds', icon: ArrowUpFromLine },
  { value: 'opening', label: 'Opening Balance (Prev Month)', icon: Wallet },
] as const;

// ─── Form Schema ──────────────────────────────────────────────────────────────

const fundMovementSchema = z
  .object({
    movementType: z.enum(['transfer', 'add', 'withdraw', 'opening']),
    fromAccount: z.string().optional(),
    toAccount: z.string().optional(),
    // Reverted back to string parsing to prevent TS conflicts
    amount: z
      .string()
      .min(1, 'Amount is required')
      .refine((val) => !isNaN(Number(val)) && Number(val) > 0, 'Must be greater than 0'),
    date: z.string().min(1, 'Date is required'),
    notes: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.movementType === 'transfer') {
        return !!data.fromAccount && !!data.toAccount && data.fromAccount !== data.toAccount;
      }
      if (data.movementType === 'add' || data.movementType === 'opening') {
        return !!data.toAccount;
      }
      if (data.movementType === 'withdraw') {
        return !!data.fromAccount;
      }
      return true;
    },
    {
      message: 'Please select valid accounts for this movement',
      path: ['toAccount'], // Attach error to the toAccount field generally
    }
  );

type FundMovementFormData = z.infer<typeof fundMovementSchema>;

// ─── Sub-components ───────────────────────────────────────────────────────────

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
        className="p-2 sm:p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
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
        className="p-2 sm:p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function AccountBadge({ account }: { account: string }) {
  const cfg = ACCOUNT_CONFIG[account] || ACCOUNT_CONFIG.external;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold px-2 py-1 rounded-md whitespace-nowrap ${cfg.bg} ${cfg.color} border ${cfg.border}`}
    >
      <Icon size={12} />
      {cfg.label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FundManagement() {
  const canMutate = useCanMutate();
  const { fundMovements, refreshFundMovements, refreshFundBalances } = useERP();

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

  // ── UI States ──
  const [showEntryDrawer, setShowEntryDrawer] = useState(false);
  const [viewTarget, setViewTarget] = useState<FundMovement | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void | Promise<void>) | null>(null);
  const [passwordModalTitle, setPasswordModalTitle] = useState('');

  // Lock page scroll and allow Escape to close while the drawer / details modal is open.
  useEffect(() => {
    if (!showEntryDrawer && !viewTarget) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setShowEntryDrawer(false);
      setViewTarget(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showEntryDrawer, viewTarget]);

  // ── Form Setup ──
  const {
    register,
    handleSubmit: handleFormSubmit,
    formState: { errors, isSubmitting },
    reset,
    control,
  } = useForm<FundMovementFormData>({
    resolver: zodResolver(fundMovementSchema),
    defaultValues: {
      movementType: 'transfer',
      fromAccount: '',
      toAccount: '',
      amount: '',
      date: todayISO(),
      notes: '',
    },
  });

  const watchMovementType = useWatch({ control, name: 'movementType' });

  // ── Derived Data ──
  const monthFundMovements = useMemo(() => {
    return fundMovements.filter((movement) => {
      const isRightMonth =
        movement.date instanceof Date &&
        movement.date.getFullYear() === selectedMonth.year &&
        movement.date.getMonth() === selectedMonth.month;
      return isRightMonth;
    });
  }, [fundMovements, selectedMonth]);

  const netFlows = useMemo(() => {
    const flows = { cash: 0, bank: 0, bkash: 0, reserve: 0 };
    monthFundMovements.forEach((movement) => {
      const amount = movement.amount;
      const from = movement.fromAccount || '';
      const to = movement.toAccount || '';
      if (from && from in flows) flows[from as keyof typeof flows] -= amount;
      if (to && to in flows) flows[to as keyof typeof flows] += amount;
    });
    return flows;
  }, [monthFundMovements]);

  const filteredFunds = useMemo(() => {
    if (!searchQuery) return monthFundMovements;
    const lowerQ = searchQuery.toLowerCase();
    return monthFundMovements.filter(
      (movement) =>
        movement.notes.toLowerCase().includes(lowerQ) ||
        (movement.fromAccount && movement.fromAccount.toLowerCase().includes(lowerQ)) ||
        (movement.toAccount && movement.toAccount.toLowerCase().includes(lowerQ)) ||
        MOVEMENT_TYPE_LABELS[movement.movementType].toLowerCase().includes(lowerQ)
    );
  }, [monthFundMovements, searchQuery]);

  const { paginatedData, pagination } = useClientPagination(filteredFunds, {
    initialPageSize: 10,
    pageSizeOptions: [10, 20, 50],
  });

  // ── Handlers ──
  const onSubmit = useCallback(
    async (data: FundMovementFormData) => {
      try {
        await fundsService.create({
          movementType: data.movementType,
          fromAccount: data.fromAccount ? (data.fromAccount as FundAccountType) : undefined,
          toAccount: data.toAccount ? (data.toAccount as FundAccountType) : undefined,
          amount: Number(data.amount), // Convert to float for the backend
          date: data.date,
          notes: data.notes?.trim() || undefined,
        });
        await refreshFundMovements();
        await refreshFundBalances();
        toast.success('Movement recorded successfully');
        reset({ ...data, amount: '', notes: '' });
        setShowEntryDrawer(false);
      } catch (error) {
        handleError(error, { action: 'add_fund_movement', severity: 'high' });
      }
    },
    [refreshFundMovements, refreshFundBalances, reset]
  );

  const handleDelete = useCallback(
    (id: string) => {
      setPasswordModalTitle('Delete Movement');
      setPendingAction(() => async () => {
        try {
          await fundsService.delete(id);
          await refreshFundMovements();
          await refreshFundBalances();
          toast.success('Record deleted successfully');
        } catch (error) {
          handleError(error, { action: 'delete_fund_movement', severity: 'high' });
        }
      });
      setPasswordModalOpen(true);
    },
    [refreshFundMovements, refreshFundBalances]
  );

  // Export mapping
  const exportConfig = useMemo(
    () => ({
      filenameBase: `fund_movements_${selectedMonth.year}_${selectedMonth.month + 1}`,
      title: 'Account Movements',
      subtitle: monthLabel,
      columns: [
        {
          header: 'Date',
          accessor: 'date' as const,
          format: (v: string | number | null | undefined) => formatDate(new Date(String(v))),
        },
        { header: 'Type', accessor: 'movementType' as const },
        {
          header: 'From',
          accessor: (row: FundMovement) => row.fromAccount ?? 'External',
        },
        {
          header: 'To',
          accessor: (row: FundMovement) => row.toAccount ?? 'External',
        },
        {
          header: 'Amount',
          accessor: 'amount' as const,
          format: (v: string | number | null | undefined) => Number(v).toFixed(2),
        },
        { header: 'Notes', accessor: 'notes' as const },
      ] satisfies ColDef<FundMovement>[],
      sheetName: 'Movements',
      getData: () => filteredFunds,
    }),
    [filteredFunds, monthLabel, selectedMonth]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-w-0 space-y-4 pb-20 sm:space-y-5 sm:pb-0">
      <ManagerPasswordModal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        onConfirm={() => {
          void pendingAction?.();
          setPasswordModalOpen(false);
        }}
        title={passwordModalTitle}
        requiredRole="owner"
      />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 via-white to-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="shrink-0 rounded-xl border border-indigo-100 bg-indigo-50 p-2.5 text-indigo-600">
              <Wallet size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">
                Transfers, deposits, and withdrawals
              </p>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <MonthNavigator
              label={monthLabel}
              onPrev={goToPrevMonth}
              onNext={goToNextMonth}
              disableNext={isCurrentMonth}
            />
            {canMutate && (
              <button
                type="button"
                onClick={() => setShowEntryDrawer(true)}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
              >
                <ArrowRightLeft size={16} />
                Log movement
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-4 sm:gap-3 sm:p-4">
          {[
            {
              key: 'cash',
              label: 'Cash',
              icon: Banknote,
              colors: 'text-emerald-600 bg-emerald-50',
            },
            { key: 'bkash', label: 'bKash', icon: Smartphone, colors: 'text-pink-600 bg-pink-50' },
            { key: 'bank', label: 'Bank', icon: Landmark, colors: 'text-blue-600 bg-blue-50' },
            {
              key: 'reserve',
              label: 'Reserve',
              icon: Vault,
              colors: 'text-purple-600 bg-purple-50',
            },
          ].map((flow) => {
            const amount = netFlows[flow.key as keyof typeof netFlows] || 0;
            const Icon = flow.icon;
            return (
              <div
                key={flow.key}
                className="min-w-0 rounded-xl border border-slate-100 bg-white px-3 py-2.5 sm:px-3.5"
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span className={`rounded-md p-1.5 ${flow.colors}`}>
                    <Icon size={13} />
                  </span>
                  <span className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    {flow.label} net flow
                  </span>
                </div>
                <p
                  className={`truncate text-sm font-extrabold tabular-nums sm:text-base ${amount === 0 ? 'text-slate-600' : amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                >
                  {amount > 0 ? '+' : ''}
                  {formatCurrency(amount)}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="relative w-full sm:max-w-sm">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              aria-label="Search account movements"
              placeholder="Search notes or accounts..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
            <span className="text-xs font-medium text-slate-500 sm:hidden">
              {filteredFunds.length} records
            </span>
            <ExportDropdown config={exportConfig} disabled={filteredFunds.length === 0} />
          </div>
        </div>

        <div className="divide-y divide-slate-100 sm:hidden">
          {paginatedData.length > 0 ? (
            paginatedData.map((movement) => (
              <article key={movement.id} className="space-y-2.5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700">
                      {formatDate(movement.date)}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-slate-500">
                      {MOVEMENT_TYPE_LABELS[movement.movementType]}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-extrabold tabular-nums text-slate-800">
                    {formatCurrency(movement.amount)}
                  </p>
                </div>
                <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                  {movement.fromAccount ? (
                    <AccountBadge account={movement.fromAccount} />
                  ) : (
                    <span className="text-xs text-slate-400">External</span>
                  )}
                  <ArrowRight size={12} className="shrink-0 text-slate-300" />
                  {movement.toAccount ? (
                    <AccountBadge account={movement.toAccount} />
                  ) : (
                    <span className="text-xs text-slate-400">External</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-xs text-slate-500">
                    {movement.notes || 'No notes'}
                  </p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setViewTarget(movement)}
                      aria-label={`View movement from ${formatDate(movement.date)}`}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                    >
                      <Eye size={14} />
                      View
                    </button>
                    {canMutate && (
                      <button
                        type="button"
                        onClick={() => handleDelete(movement.id)}
                        aria-label="Delete movement"
                        className="shrink-0 rounded-lg bg-slate-50 p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))
          ) : (
            <EmptyMovements />
          )}
        </div>

        <div className="hidden overflow-hidden sm:block">
          <table className="w-full table-fixed text-left">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="w-[15%] px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Date
                </th>
                <th className="w-[30%] px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Movement
                </th>
                <th className="w-[17%] px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Amount
                </th>
                <th className="hidden w-[20%] px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 md:table-cell">
                  Notes
                </th>
                <th className="w-[18%] px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedData.length > 0 ? (
                paginatedData.map((movement) => (
                  <tr key={movement.id} className="group hover:bg-indigo-50/30">
                    <td className="truncate px-4 py-3.5 text-xs font-medium text-slate-600">
                      {formatDate(movement.date)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                        {movement.fromAccount ? (
                          <AccountBadge account={movement.fromAccount} />
                        ) : (
                          <span className="text-xs text-slate-400">External</span>
                        )}
                        <ArrowRight size={12} className="shrink-0 text-slate-300" />
                        {movement.toAccount ? (
                          <AccountBadge account={movement.toAccount} />
                        ) : (
                          <span className="text-xs text-slate-400">External</span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-[10px] text-slate-400">
                        {MOVEMENT_TYPE_LABELS[movement.movementType]}
                      </p>
                    </td>
                    <td className="truncate px-4 py-3.5 text-right text-sm font-extrabold tabular-nums text-slate-800">
                      {formatCurrency(movement.amount)}
                    </td>
                    <td className="hidden max-w-0 px-4 py-3.5 md:table-cell">
                      <span
                        className="block truncate text-xs text-slate-500"
                        title={movement.notes || MOVEMENT_TYPE_LABELS[movement.movementType]}
                      >
                        {movement.notes || MOVEMENT_TYPE_LABELS[movement.movementType]}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setViewTarget(movement)}
                          aria-label={`View movement from ${formatDate(movement.date)}`}
                          className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                        >
                          <Eye size={14} />
                          <span>View</span>
                        </button>
                        {canMutate && (
                          <button
                            type="button"
                            onClick={() => handleDelete(movement.id)}
                            aria-label="Delete movement"
                            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    <EmptyMovements />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredFunds.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:px-5">
            <p className="text-xs text-slate-500">
              <span className="font-bold text-slate-700">{filteredFunds.length}</span> record
              {filteredFunds.length !== 1 ? 's' : ''}
            </p>
            <Pagination pagination={pagination} showPageInfo={false} />
          </div>
        )}
      </section>

      {/* Movement details — portalled to <body> so it always covers the full viewport. */}
      {viewTarget &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
            <button
              type="button"
              aria-label="Close movement details"
              onClick={() => setViewTarget(null)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]"
            />
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="movement-details-title"
              className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-4 sm:px-5">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="shrink-0 rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
                    <ArrowRightLeft size={18} />
                  </span>
                  <div className="min-w-0">
                    <h2 id="movement-details-title" className="text-base font-bold text-slate-800">
                      Movement details
                    </h2>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {MOVEMENT_TYPE_LABELS[viewTarget.movementType]}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewTarget(null)}
                  aria-label="Close"
                  className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 p-4 sm:p-5">
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Amount
                  </p>
                  <p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-800">
                    {formatCurrency(viewTarget.amount)}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="min-w-0 rounded-xl border border-slate-100 p-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      From
                    </p>
                    {viewTarget.fromAccount ? (
                      <AccountBadge account={viewTarget.fromAccount} />
                    ) : (
                      <span className="text-sm text-slate-600">External</span>
                    )}
                  </div>
                  <div className="min-w-0 rounded-xl border border-slate-100 p-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      To
                    </p>
                    {viewTarget.toAccount ? (
                      <AccountBadge account={viewTarget.toAccount} />
                    ) : (
                      <span className="text-sm text-slate-600">External</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-100 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Date
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      {formatDate(viewTarget.date)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Movement type
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      {MOVEMENT_TYPE_LABELS[viewTarget.movementType]}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Notes / reference
                  </p>
                  <p className="mt-1 break-words text-sm text-slate-700">
                    {viewTarget.notes || 'No notes added'}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-right sm:px-5">
                <button
                  type="button"
                  onClick={() => setViewTarget(null)}
                  className="min-h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                >
                  Close
                </button>
              </div>
            </section>
          </div>,
          document.body
        )}

      {/* Log movement drawer — portalled to <body> and sized to the full viewport height,
          so no parent layout can leave a gap at the top. */}
      {showEntryDrawer &&
        createPortal(
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              aria-label="Close movement form"
              onClick={() => setShowEntryDrawer(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]"
            />
            <aside
              role="dialog"
              aria-modal="true"
              aria-labelledby="fund-drawer-title"
              className="absolute inset-y-0 right-0 flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl"
            >
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
                <div>
                  <h2
                    id="fund-drawer-title"
                    className="text-base font-bold text-slate-800 sm:text-lg"
                  >
                    Log movement
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Choose what happened, then enter the accounts and amount.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEntryDrawer(false)}
                  aria-label="Close"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
                {canMutate ? (
                  <form
                    id="fund-movement-form"
                    onSubmit={handleFormSubmit(onSubmit)}
                    className="space-y-5"
                  >
                    <fieldset>
                      <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                        Movement type
                      </legend>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {MOVEMENT_TYPES.map((type) => {
                          const Icon = type.icon;
                          const selected = watchMovementType === type.value;
                          return (
                            <label
                              key={type.value}
                              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${selected ? 'border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
                            >
                              <input
                                type="radio"
                                value={type.value}
                                {...register('movementType')}
                                className="sr-only"
                              />
                              <span
                                className={`mt-0.5 rounded-lg p-2 ${selected ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}
                              >
                                <Icon size={16} />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-xs font-semibold text-slate-800">
                                  {type.label}
                                </span>
                                <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
                                  {type.value === 'transfer' &&
                                    'Move money from one account to another.'}
                                  {type.value === 'add' &&
                                    'Record outside funds added to an account.'}
                                  {type.value === 'withdraw' &&
                                    'Record funds taken out of an account.'}
                                  {type.value === 'opening' &&
                                    'Set a starting balance for an account.'}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {(watchMovementType === 'transfer' || watchMovementType === 'withdraw') && (
                        <label className={watchMovementType === 'withdraw' ? 'sm:col-span-2' : ''}>
                          <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                            From account
                          </span>
                          <select
                            {...register('fromAccount')}
                            className={`h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 ${errors.fromAccount ? 'border-rose-400' : 'border-slate-200'}`}
                          >
                            <option value="">Select account</option>
                            {Object.entries(ACCOUNT_CONFIG)
                              .filter(([key]) => key !== 'external')
                              .map(([key, config]) => (
                                <option key={key} value={key}>
                                  {config.label}
                                </option>
                              ))}
                          </select>
                        </label>
                      )}
                      {(watchMovementType === 'transfer' ||
                        watchMovementType === 'add' ||
                        watchMovementType === 'opening') && (
                        <label
                          className={
                            watchMovementType === 'add' || watchMovementType === 'opening'
                              ? 'sm:col-span-2'
                              : ''
                          }
                        >
                          <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                            To account
                          </span>
                          <select
                            {...register('toAccount')}
                            className={`h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 ${errors.toAccount ? 'border-rose-400' : 'border-slate-200'}`}
                          >
                            <option value="">Select account</option>
                            {Object.entries(ACCOUNT_CONFIG)
                              .filter(([key]) => key !== 'external')
                              .map(([key, config]) => (
                                <option key={key} value={key}>
                                  {config.label}
                                </option>
                              ))}
                          </select>
                        </label>
                      )}
                      {errors.toAccount && (
                        <p className="text-xs text-rose-600 sm:col-span-2">
                          {errors.toAccount.message}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label>
                        <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                          Amount (৳)
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          inputMode="decimal"
                          placeholder="0.00"
                          {...register('amount')}
                          className={`h-11 w-full rounded-xl border bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 ${errors.amount ? 'border-rose-400' : 'border-slate-200'}`}
                        />
                        {errors.amount && (
                          <span className="mt-1 block text-xs text-rose-600">
                            {errors.amount.message}
                          </span>
                        )}
                      </label>
                      <label>
                        <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                          Date
                        </span>
                        <input
                          type="date"
                          max={todayISO()}
                          {...register('date')}
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                        Notes / reference{' '}
                        <span className="font-normal text-slate-400">(optional)</span>
                      </span>
                      <input
                        type="text"
                        placeholder="Add a short reference..."
                        {...register('notes')}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                      />
                    </label>
                  </form>
                ) : (
                  <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    You have read-only access to account movements.
                  </p>
                )}
              </div>

              {canMutate && (
                <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
                  <button
                    form="fund-movement-form"
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        Saving movement...
                      </>
                    ) : (
                      'Record movement'
                    )}
                  </button>
                </div>
              )}
            </aside>
          </div>,
          document.body
        )}
    </div>
  );
}

function EmptyMovements() {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center sm:py-16">
      <span className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-slate-300">
        <ArrowRightLeft size={24} />
      </span>
      <p className="text-sm font-semibold text-slate-600">No account movements found</p>
      <p className="text-xs text-slate-400">Try another month or adjust your search.</p>
    </div>
  );
}
