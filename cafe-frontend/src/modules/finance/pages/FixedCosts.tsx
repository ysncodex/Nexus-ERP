import { useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Building2,
  Pencil,
  Trash2,
  Plus,
  X,
  ChevronDown,
  Banknote,
  Smartphone,
  Landmark,
  Search,
  Layers,
  Hash,
  type LucideIcon,
} from 'lucide-react';
import { useERP } from '@/core/context/useERP';
import {
  ManagerPasswordModal,
  EditTransactionModal,
  ManageListModal,
  ButtonLoading,
  Pagination,
} from '@/shared/components/ui';
import { useClientPagination, useCanMutate } from '@/shared/hooks';
import { fixedCostSchema, type FixedCostFormData, handleError } from '@/shared/utils';
import { ExportDropdown, TRANSACTION_EXPORT_COLUMNS } from '@/shared/export';
import type { Transaction } from '@/core/types';
import RangeCalendar from '@/shared/components/ui/Calendar/CustomCalendar';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

// ─── Constants ────────────────────────────────────────────────────────────────

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

type MethodFilterValue = 'all' | 'cash' | 'bank' | 'bkash';

// ─── Sub-components ───────────────────────────────────────────────────────────

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
    <div className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-slate-100 shadow-sm">
      <div className={`p-2.5 rounded-xl shrink-0 ${iconBg}`}>
        <Icon size={16} strokeWidth={2.5} className={iconColor} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">
          {label}
        </p>
        <p
          className={`text-base font-extrabold tabular-nums tracking-tight leading-none ${valueColor}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  const cfg = METHOD_CONFIG[method];
  if (!cfg) return <span className="text-xs text-slate-500 capitalize">{method}</span>;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-md ${cfg.bg} ${cfg.color}`}
    >
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FixedCosts() {
  const canMutate = useCanMutate();
  const {
    stats,
    filteredTransactions,
    addTransaction,
    deleteTransaction,
    updateTransaction,
    fixedCostItems,
    suppliers,
    addFixedCostItem,
    renameFixedCostItem,
    deleteFixedCostItem,
    setCustomDateRange,
    customDateRange,
  } = useERP();

  const [costDate, setCostDate] = useState(todayISO);
  const [newItemName, setNewItemName] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [manageDescriptionOpen, setManageDescriptionOpen] = useState(false);

  // Manager Password Modal
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [passwordModalTitle, setPasswordModalTitle] = useState('');

  // Edit Transaction Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Table filters
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<MethodFilterValue>('all');
  const {
    register,
    handleSubmit: handleFormSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
  } = useForm<FixedCostFormData>({
    resolver: zodResolver(fixedCostSchema),
    defaultValues: {
      description: '',
      amount: '',
      method: 'cash',
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (data: FixedCostFormData) => {
      try {
        addTransaction({
          type: 'expense_fixed',
          category: 'Fixed',
          amount: Number(data.amount),
          method: data.method,
          description: data.description || 'Fixed Cost',
          date: parseLocalDate(costDate),
        });
        toast.success('Fixed cost added successfully');
        reset();
        setCostDate(todayISO());
      } catch (error) {
        handleError(error, {
          action: 'add_fixed_cost',
          severity: 'high',
          metadata: { amount: data.amount, description: data.description },
        });
      }
    },
    [addTransaction, reset, costDate]
  );

  const handleManagerDelete = useCallback(
    (id: string) => {
      setPasswordModalTitle('Delete Transaction');
      setPendingAction(() => () => {
        try {
          deleteTransaction(id);
          toast.success('Transaction deleted successfully');
        } catch (error) {
          handleError(error, {
            action: 'delete_fixed_cost',
            severity: 'high',
            metadata: { transactionId: id },
          });
        }
      });
      setPasswordModalOpen(true);
    },
    [deleteTransaction]
  );

  const handleManagerEdit = useCallback((transaction: Transaction) => {
    setPasswordModalTitle('Edit Transaction');
    setPendingAction(() => () => {
      setEditingTransaction(transaction);
      setEditModalOpen(true);
    });
    setPasswordModalOpen(true);
  }, []);

  const handleSaveEdit = useCallback(
    (updated: Transaction) => {
      try {
        updateTransaction(updated);
        toast.success('Transaction updated successfully');
      } catch (error) {
        handleError(error, {
          action: 'update_fixed_cost',
          severity: 'high',
          metadata: { transactionId: updated.id },
        });
      }
    },
    [updateTransaction]
  );

  const handleAddItemName = useCallback(async () => {
    const trimmed = newItemName.trim();
    if (!trimmed) {
      toast.error('Enter a description name');
      return;
    }
    setAddingItem(true);
    try {
      await addFixedCostItem(trimmed);
      setValue('description', trimmed);
      setNewItemName('');
      setShowAddItem(false);
      toast.success('Description added');
    } catch (error) {
      handleError(error, {
        action: 'add_fixed_description',
        severity: 'medium',
        metadata: { itemName: trimmed },
      });
      toast.error('Could not save description — check you are logged in as owner/manager');
    } finally {
      setAddingItem(false);
    }
  }, [newItemName, addFixedCostItem, setValue]);

  const handleClosePasswordModal = useCallback(() => {
    setPasswordModalOpen(false);
    setPendingAction(null);
  }, []);

  const handleConfirmPassword = useCallback(() => {
    pendingAction?.();
  }, [pendingAction]);

  const handleCloseEditModal = useCallback(() => {
    setEditModalOpen(false);
    setEditingTransaction(null);
  }, []);

  const handleCancelAddItem = useCallback(() => {
    setShowAddItem(false);
    setNewItemName('');
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────

  const fixedExpenses = useMemo(
    () => filteredTransactions.filter((t) => t.type === 'expense_fixed'),
    [filteredTransactions]
  );

  const fixedByMethod = useMemo(() => {
    const b = { cash: 0, bank: 0, bkash: 0 };
    fixedExpenses.forEach((t) => {
      const method = t.method ?? 'cash';
      if (method in b) b[method as keyof typeof b] += t.amount;
    });
    return b;
  }, [fixedExpenses]);

  const largestEntry = useMemo(
    () => (fixedExpenses.length > 0 ? Math.max(...fixedExpenses.map((t) => t.amount)) : 0),
    [fixedExpenses]
  );

  const hasActiveFilters = searchQuery !== '' || methodFilter !== 'all';

  const filteredExpenses = useMemo(() => {
    return fixedExpenses.filter((t) => {
      if (searchQuery && !t.description.toLowerCase().includes(searchQuery.toLowerCase()))
        return false;
      if (methodFilter !== 'all' && t.method !== methodFilter) return false;
      return true;
    });
  }, [fixedExpenses, searchQuery, methodFilter]);

  const filteredTotal = useMemo(
    () => filteredExpenses.reduce((s, t) => s + t.amount, 0),
    [filteredExpenses]
  );

  const { paginatedData: paginatedExpenses, pagination } = useClientPagination(filteredExpenses, {
    initialPageSize: 7,
    pageSizeOptions: [7, 10, 20],
  });

  const exportConfig = useMemo(
    () => ({
      filenameBase: 'fixed_costs',
      title: 'Fixed Costs',
      subtitle: 'Recurring overhead expenses',
      columns: TRANSACTION_EXPORT_COLUMNS,
      sheetName: 'Fixed Costs',
      getData: () => filteredExpenses,
      summaryRows: filteredExpenses.length
        ? ([['TOTAL (৳)', filteredTotal]] as Array<[string, string | number]>)
        : undefined,
    }),
    [filteredExpenses, filteredTotal]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in zoom-in-95 duration-300">
      <ManagerPasswordModal
        isOpen={passwordModalOpen}
        onClose={handleClosePasswordModal}
        onConfirm={handleConfirmPassword}
        title={passwordModalTitle}
      />
      <EditTransactionModal
        isOpen={editModalOpen}
        onClose={handleCloseEditModal}
        transaction={editingTransaction}
        onSave={handleSaveEdit}
        itemNames={fixedCostItems.map((i) => i.name)}
        suppliers={suppliers.map((s) => s.name)}
      />
      <ManageListModal
        isOpen={manageDescriptionOpen}
        onClose={() => setManageDescriptionOpen(false)}
        title="Manage Descriptions"
        items={fixedCostItems.map((i) => i.name)}
        emptyText="No descriptions saved yet."
        onRename={renameFixedCostItem}
        onDelete={deleteFixedCostItem}
      />

      {/* ── Add Form Panel ───────────────────────────────────────────────── */}
      <div className="bg-white/90 backdrop-blur p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 h-fit lg:sticky lg:top-28">
        {/* Panel header */}
        <div className="flex items-start justify-between gap-3 mb-5 pb-5 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-100 text-purple-600">
              <Building2 size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 leading-tight">Fixed Costs</h3>
              <p className="text-xs text-slate-500 mt-0.5">Record rent &amp; salaries</p>
            </div>
          </div>
          {/* Period total pill */}
          {stats.totalFixedCost > 0 && (
            <div className="shrink-0 text-right bg-purple-50 border border-purple-100 rounded-xl px-3 py-2">
              <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest leading-none mb-1">
                Period
              </p>
              <p className="text-sm font-extrabold text-purple-700 tabular-nums">
                {stats.totalFixedCost.toLocaleString()} ৳
              </p>
            </div>
          )}
        </div>

        {canMutate && (
          <form onSubmit={handleFormSubmit(handleSubmit)} className="space-y-5">
            {/* Description Field */}
            <div>
              <div className="flex justify-between items-center gap-3 mb-2">
                <label
                  htmlFor="fixed-description"
                  className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide"
                >
                  Description
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setManageDescriptionOpen(true)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    aria-label="Manage saved descriptions"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddItem(!showAddItem)}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    <Plus size={12} /> Add New
                  </button>
                </div>
              </div>

              {showAddItem ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="New description..."
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void handleAddItemName()}
                    disabled={addingItem}
                    className="flex-1 h-11 px-4 bg-indigo-50 border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm disabled:opacity-60"
                    aria-label="New description name"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => void handleAddItemName()}
                    disabled={addingItem || !newItemName.trim()}
                    className="h-11 px-4 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60"
                  >
                    {addingItem ? 'Adding…' : 'Add'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelAddItem}
                    className="h-11 px-3 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors"
                    aria-label="Cancel adding new description"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <select
                      id="fixed-description"
                      {...register('description')}
                      className={`w-full h-11 pl-4 pr-10 bg-slate-50 border ${
                        errors.description ? 'border-red-400' : 'border-slate-200'
                      } rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 appearance-none text-sm cursor-pointer`}
                    >
                      <option value="">Select description...</option>
                      {fixedCostItems.map((item) => (
                        <option key={item.id} value={item.name}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      aria-hidden="true"
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 z-10"
                    />
                  </div>
                  {fixedCostItems.length === 0 && (
                    <p className="text-[11px] text-slate-500 mt-2">
                      No descriptions saved yet — click "Add New".
                    </p>
                  )}
                  {errors.description && (
                    <p className="text-xs text-red-600 mt-1" role="alert">
                      {errors.description.message}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Amount Field */}
            <div>
              <label
                htmlFor="fixed-amount"
                className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block"
              >
                Total Cost
              </label>
              <input
                id="fixed-amount"
                type="number"
                placeholder="0.00"
                min="0"
                step="0.01"
                {...register('amount')}
                className={`w-full h-11 px-4 bg-slate-50 border ${
                  errors.amount ? 'border-red-400' : 'border-slate-200'
                } rounded-xl outline-none font-bold text-sm focus:ring-2 focus:ring-indigo-500`}
              />
              {errors.amount && (
                <p className="text-xs text-red-600 mt-1" role="alert">
                  {errors.amount.message}
                </p>
              )}
            </div>

            {/* Payment Method + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="fixed-method"
                  className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block"
                >
                  Paid Via
                </label>
                <div className="relative">
                  <select
                    id="fixed-method"
                    {...register('method')}
                    className="w-full h-11 pl-4 pr-10 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 appearance-none text-sm cursor-pointer"
                  >
                    <option value="cash">Cash</option>
                    <option value="bank">Bank</option>
                    <option value="bkash">bKash</option>
                  </select>
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 z-10"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="fixed-date"
                  className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block"
                >
                  Payment Date
                </label>
                <input
                  id="fixed-date"
                  type="date"
                  value={costDate}
                  max={todayISO()}
                  onChange={(e) => setCostDate(e.target.value)}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm cursor-pointer"
                />
              </div>
            </div>

            <ButtonLoading
              loading={isSubmitting}
              type="submit"
              className="w-full min-h-12 px-4 py-3.5 text-white rounded-xl font-bold shadow-lg mt-2 bg-purple-600 hover:bg-purple-700 flex items-center justify-center whitespace-nowrap transition-transform active:scale-[0.99]"
            >
              Save Cost
            </ButtonLoading>
          </form>
        )}
      </div>

      {/* ── Summary + History Panel ─────────────────────────────────────── */}
      <div className="lg:col-span-2 space-y-5">
        {/* ── Summary Card ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Summary header */}
          <div className="p-5 md:p-6 bg-gradient-to-r from-purple-50 via-white to-slate-50 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-100 rounded-xl text-purple-600 shadow-sm">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Fixed Cost Summary</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Recurring expenses overview</p>
                </div>
              </div>
              <div className="shrink-0 bg-purple-600 text-white px-4 py-2.5 rounded-xl shadow-sm">
                <p className="text-[10px] font-bold text-purple-200 uppercase tracking-widest leading-none mb-1">
                  Total
                </p>
                <p className="text-xl font-extrabold tabular-nums">
                  {stats.totalFixedCost.toLocaleString()} ৳
                </p>
              </div>
            </div>

            {/* Mini stats row */}
            <div className="grid grid-cols-3 gap-3">
              <MiniStat
                label="Entries"
                value={fixedExpenses.length.toString()}
                icon={Hash}
                iconColor="text-purple-600"
                iconBg="bg-purple-100"
              />
              <MiniStat
                label="Categories"
                value={stats.topFixed.length.toString()}
                icon={Layers}
                iconColor="text-indigo-600"
                iconBg="bg-indigo-100"
              />
              <MiniStat
                label="Largest Entry"
                value={`${largestEntry.toLocaleString()} ৳`}
                icon={Building2}
                iconColor="text-rose-500"
                iconBg="bg-rose-50"
                valueColor="text-rose-600"
              />
            </div>
          </div>

          <div className="p-5 md:p-6 space-y-5">
            {/* Category breakdown */}
            {stats.topFixed.length > 0 ? (
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                  By Category
                </h4>
                <div className="space-y-3">
                  {stats.topFixed.map((item) => {
                    const pct =
                      stats.totalFixedCost > 0
                        ? Math.round((item.amount / stats.totalFixedCost) * 100)
                        : 0;
                    return (
                      <div key={item.name}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                            <span className="text-sm font-semibold text-slate-700 truncate">
                              {item.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0 ml-3">
                            <span className="text-sm font-extrabold text-purple-700 tabular-nums">
                              {item.amount.toLocaleString()} ৳
                            </span>
                            <span className="text-[11px] font-bold text-slate-400 w-8 text-right">
                              {pct}%
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 text-sm">
                No fixed costs recorded for this period.
              </div>
            )}

            {/* Payment method split */}
            {fixedExpenses.length > 0 && (
              <>
                <div className="border-t border-slate-100" />
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                    Payment Methods
                  </h4>
                  <div className="grid grid-cols-3 gap-2.5">
                    {(
                      Object.entries(METHOD_CONFIG) as [string, (typeof METHOD_CONFIG)[string]][]
                    ).map(([key, cfg]) => {
                      const amount = fixedByMethod[key as keyof typeof fixedByMethod];
                      const pct =
                        stats.totalFixedCost > 0
                          ? Math.round((amount / stats.totalFixedCost) * 100)
                          : 0;
                      const Icon = cfg.icon;
                      return (
                        <div
                          key={key}
                          className={`p-3.5 rounded-xl border ${cfg.border} ${cfg.bg} flex flex-col gap-2`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon size={13} className={cfg.color} />
                            <span className={`text-[11px] font-bold ${cfg.color}`}>
                              {cfg.label}
                            </span>
                          </div>
                          <p className="text-sm font-extrabold text-slate-800 tabular-nums">
                            {amount.toLocaleString()} ৳
                          </p>
                          <div className="h-1 bg-white/60 rounded-full overflow-hidden">
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
                          <span className="text-[10px] font-semibold text-slate-500">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── History Log ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Table header with date filter */}
          <div className="px-5 md:px-6 py-4 bg-slate-50/60 border-b border-slate-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="font-bold text-slate-700 text-sm">Fixed Cost History</h3>
                <p className="text-xs text-slate-500 mt-0.5">All fixed cost transactions</p>
              </div>
              <RangeCalendar value={customDateRange} onRangeChange={setCustomDateRange} align="right" />
            </div>

            {/* Filter bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5">
              {/* Search */}
              <div className="relative flex-1 w-full sm:max-w-xs">
                <Search
                  size={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="Search descriptions…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>

              {/* Method filter */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shrink-0">
                {(['all', 'cash', 'bank', 'bkash'] as const).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setMethodFilter(val)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors ${
                      methodFilter === val
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {val === 'all'
                      ? 'All'
                      : val === 'bkash'
                        ? 'bKash'
                        : val.charAt(0).toUpperCase() + val.slice(1)}
                  </button>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 sm:ml-auto shrink-0">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setMethodFilter('all');
                    }}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 underline underline-offset-2 transition-colors"
                  >
                    Clear
                  </button>
                )}
                <ExportDropdown config={exportConfig} disabled={filteredExpenses.length === 0} />
              </div>
            </div>

            {/* Results summary */}
            {hasActiveFilters && (
              <p className="text-[11px] text-slate-500 mt-2">
                Showing <span className="font-bold text-slate-700">{filteredExpenses.length}</span>{' '}
                of <span className="font-bold text-slate-700">{fixedExpenses.length}</span> entries
              </p>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100 hover:scrollbar-thumb-slate-400">
            <table className="w-full text-left min-w-[580px]">
              <thead className="bg-slate-50 border-b-2 border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Via
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Cost
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedExpenses.length > 0 ? (
                  paginatedExpenses.map((t) => (
                    <tr key={t.id} className="hover:bg-purple-50/30 transition-colors group">
                      <td className="px-4 py-3 text-xs font-medium text-slate-600 whitespace-nowrap">
                        {t.date?.toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-slate-700">
                          {t.description}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <MethodBadge method={t.method ?? 'cash'} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-extrabold text-purple-700 tabular-nums">
                          -{t.amount.toLocaleString()} ৳
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {canMutate && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                            <button
                              onClick={() => handleManagerEdit(t)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              aria-label={`Edit transaction: ${t.description}`}
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => handleManagerDelete(t.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              aria-label={`Delete transaction: ${t.description}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-14 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-3.5 bg-slate-50 rounded-2xl">
                          <Building2 size={24} className="text-slate-300" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-500">
                            No fixed costs found
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {hasActiveFilters
                              ? 'Try adjusting your filters'
                              : 'No records for the selected period'}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {filteredExpenses.length > 0 && (
            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                <span className="font-bold text-slate-700">{filteredExpenses.length}</span> entr
                {filteredExpenses.length !== 1 ? 'ies' : 'y'} ·{' '}
                <span className="font-bold text-purple-700">
                  {filteredTotal.toLocaleString()} ৳
                </span>{' '}
                total
              </p>
              <Pagination pagination={pagination} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
