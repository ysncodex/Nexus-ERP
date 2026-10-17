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
  List,
  LayoutGrid,
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
import {
  fixedCostSchema,
  type FixedCostFormData,
  handleError,
  getStoredUser,
} from '@/shared/utils';
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
// Ensure strict fraction formatting for ERP consistency
function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function isBankFeeDescription(value: string): boolean {
  return /\b(?:card|bank|pos|merchant|payment processing)[\s-]+(?:(?:processing|transaction)[\s-]+)?(?:fees?|charges?)\b/i.test(
    value
  );
}
const EXPENSE_DESCRIPTION_SEPARATOR = '\n[Note] ';
function getExpenseDescriptionParts(value: string) {
  if (isBankFeeDescription(value)) return { name: 'Bank Fees', details: value };
  const separatorIndex = value.indexOf(EXPENSE_DESCRIPTION_SEPARATOR);
  if (separatorIndex < 0) return { name: value, details: '' };
  return {
    name: value.slice(0, separatorIndex),
    details: value.slice(separatorIndex + EXPENSE_DESCRIPTION_SEPARATOR.length),
  };
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
    <div className="flex items-center gap-2.5 sm:gap-3 p-3 sm:p-3.5 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
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
function MethodBadge({ method }: { method: string }) {
  const cfg = METHOD_CONFIG[method];
  if (!cfg)
    return <span className="text-xs text-slate-500 capitalize whitespace-nowrap">{method}</span>;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md whitespace-nowrap ${cfg.bg} ${cfg.color}`}
    >
      <Icon size={12} />
      {cfg.label}
    </span>
  );
}
// ─── Component ────────────────────────────────────────────────────────────────
export default function FixedCosts() {
  const canMutate = useCanMutate();
  const isOwner = getStoredUser()?.role === 'owner'; // Added Owner Check
  const {
    stats, // Restored global stats
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
  const [expenseDetails, setExpenseDetails] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [manageDescriptionOpen, setManageDescriptionOpen] = useState(false);
  // Entry drawer state
  const [showEntryDrawer, setShowEntryDrawer] = useState(false);
  const [historyView, setHistoryView] = useState<'table' | 'grid'>('table');
  // Owner Password Modal
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void | Promise<void>) | null>(null);
  const [passwordModalTitle, setPasswordModalTitle] = useState('');
  const [passwordModalRole, setPasswordModalRole] = useState<'owner' | 'manager'>('owner');
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
      const detail = expenseDetails.trim();
      const fullDescription = detail
        ? `${data.description}${EXPENSE_DESCRIPTION_SEPARATOR}${detail}`
        : data.description;
      try {
        addTransaction({
          type: 'expense_fixed',
          category: 'Fixed',
          amount: Number(data.amount), // Restored original backend logic
          method: data.method,
          description: fullDescription || 'Fixed Cost',
          date: parseLocalDate(costDate),
        });
        toast.success('Fixed expense recorded successfully');
        reset();
        setExpenseDetails('');
        setCostDate(todayISO());
        setShowEntryDrawer(false);
      } catch (error) {
        handleError(error, {
          action: 'add_fixed_cost',
          severity: 'high',
          metadata: { amount: data.amount, description: fullDescription },
        });
      }
    },
    [addTransaction, reset, costDate, expenseDetails]
  );
  const handleManagerDelete = useCallback(
    (id: string) => {
      setPasswordModalTitle('Delete Transaction');
      setPasswordModalRole('owner');
      setPendingAction(() => async () => {
        try {
          await deleteTransaction(id);
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
    setPasswordModalRole('owner');
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
  const hasActiveFilters = searchQuery !== '' || methodFilter !== 'all';
  const filteredExpenses = useMemo(() => {
    return fixedExpenses.filter((t) => {
      if (searchQuery && !t.description.toLowerCase().includes(searchQuery.toLowerCase()))
        return false;
      if (methodFilter !== 'all' && t.method !== methodFilter) return false;
      return true;
    });
  }, [fixedExpenses, searchQuery, methodFilter]);
  // Total specific to current filters
  const filteredTotal = useMemo(
    () => filteredExpenses.reduce((s, t) => s + t.amount, 0),
    [filteredExpenses]
  );
  // Dynamic Reactive Category Breakdown based on active filters
  const categoryBreakdown = useMemo(() => {
    const breakdownMap = new Map<string, number>();
    filteredExpenses.forEach((t) => {
      // Normalize recognizable fees for display; preserve stored descriptions and references.
      // This merges all individual POS Card Fees into a single "Bank Fees" row.
      const groupName =
        isBankFeeDescription(t.description) || isBankFeeDescription(t.category ?? '')
          ? 'Bank Fees'
          : t.category?.trim() || getExpenseDescriptionParts(t.description).name;
      const current = breakdownMap.get(groupName) || 0;
      breakdownMap.set(groupName, current + t.amount);
    });
    return Array.from(breakdownMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses]);
  const fixedByMethod = useMemo(() => {
    const b = { cash: 0, bank: 0, bkash: 0 };
    filteredExpenses.forEach((t) => {
      const method = t.method ?? 'cash';
      if (method in b) b[method as keyof typeof b] += t.amount;
    });
    return b;
  }, [filteredExpenses]);
  const largestEntry = useMemo(
    () => (filteredExpenses.length > 0 ? Math.max(...filteredExpenses.map((t) => t.amount)) : 0),
    [filteredExpenses]
  );
  // Original Pagination logic preserved
  const { paginatedData: paginatedExpenses, pagination } = useClientPagination(filteredExpenses, {
    initialPageSize: 7,
    pageSizeOptions: [7, 10, 20],
  });
  // New Pagination logic strictly for the Cost Breakdown
  const { paginatedData: paginatedCategories, pagination: categoryPagination } =
    useClientPagination(categoryBreakdown, {
      initialPageSize: 5,
      pageSizeOptions: [5, 10],
    });
  // Original Export system perfectly restored
  const exportConfig = useMemo(
    () => ({
      filenameBase: 'fixed_costs',
      title: 'Fixed Expenses',
      subtitle: 'Fixed expenses and payment history',
      columns: TRANSACTION_EXPORT_COLUMNS,
      sheetName: 'Fixed Expenses',
      getData: () => filteredExpenses,
      summaryRows: filteredExpenses.length
        ? ([['TOTAL (৳)', filteredTotal]] as Array<[string, string | number]>)
        : undefined,
    }),
    [filteredExpenses, filteredTotal]
  );
  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-w-0 space-y-4 pb-20 sm:space-y-5 sm:pb-0">
      {/* ── Modals ── */}
      <ManagerPasswordModal
        isOpen={passwordModalOpen}
        onClose={handleClosePasswordModal}
        onConfirm={handleConfirmPassword}
        title={passwordModalTitle}
        requiredRole={passwordModalRole}
      />
      <EditTransactionModal
        isOpen={editModalOpen}
        onClose={handleCloseEditModal}
        transaction={editingTransaction}
        onSave={handleSaveEdit}
        itemNames={[
          ...fixedCostItems.map((i) => i.name),
          ...(editingTransaction &&
          !fixedCostItems.some((item) => item.name === editingTransaction.description)
            ? [editingTransaction.description]
            : []),
        ]}
        suppliers={suppliers.map((s) => s.name)}
      />
      <ManageListModal
        isOpen={manageDescriptionOpen}
        onClose={() => setManageDescriptionOpen(false)}
        title="Manage Expense Types"
        items={fixedCostItems.map((i) => i.name)}
        emptyText="No expense types saved yet."
        onRename={renameFixedCostItem}
        onDelete={deleteFixedCostItem}
      />
      {showEntryDrawer && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close fixed expense form"
            onClick={() => setShowEntryDrawer(false)}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="fixed-cost-drawer-title"
            className="absolute inset-y-0 right-0 flex h-[100dvh] w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-purple-700">
                  Fixed Expenses
                </p>
                <h2 id="fixed-cost-drawer-title" className="mt-1 text-lg font-bold text-slate-900">
                  Add fixed expense
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Record rent, salaries, utilities, or another fixed expense.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEntryDrawer(false)}
                aria-label="Close fixed expense form"
                className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            {canMutate && (
              <form
                onSubmit={handleFormSubmit(handleSubmit)}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
                  <section aria-labelledby="fixed-expense-type-label">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <label
                          id="fixed-expense-type-label"
                          htmlFor="fixed-description"
                          className="text-sm font-semibold text-slate-800"
                        >
                          Expense type <span className="text-rose-600">*</span>
                        </label>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Choose a saved type, such as rent or salary.
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => setManageDescriptionOpen(true)}
                            aria-label="Manage saved expense types"
                            title="Manage saved expense types"
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                          >
                            <Pencil size={14} aria-hidden="true" /> Manage
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (showAddItem) setNewItemName('');
                            setShowAddItem(!showAddItem);
                          }}
                          aria-expanded={showAddItem}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-2.5 text-xs font-semibold text-purple-800 transition-colors hover:bg-purple-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                        >
                          {showAddItem ? (
                            <X size={14} aria-hidden="true" />
                          ) : (
                            <Plus size={14} aria-hidden="true" />
                          )}
                          {showAddItem ? 'Close' : 'Add type'}
                        </button>
                      </div>
                    </div>
                    {showAddItem ? (
                      <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-3 sm:p-4">
                        <label
                          htmlFor="new-fixed-expense-type"
                          className="text-xs font-semibold text-slate-700"
                        >
                          New expense type
                        </label>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                          Save a reusable name to keep future entries consistent.
                        </p>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                          <input
                            id="new-fixed-expense-type"
                            type="text"
                            placeholder="For example, Internet bill"
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void handleAddItemName();
                              }
                            }}
                            disabled={addingItem}
                            maxLength={80}
                            autoFocus
                            className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-shadow placeholder:text-slate-400 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 disabled:opacity-60"
                          />
                          <div className="flex gap-2 sm:shrink-0">
                            <button
                              type="button"
                              onClick={() => void handleAddItemName()}
                              disabled={addingItem || !newItemName.trim()}
                              className="min-h-11 flex-1 rounded-lg bg-purple-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-purple-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                            >
                              {addingItem ? 'Saving…' : 'Save type'}
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelAddItem}
                              disabled={addingItem}
                              aria-label="Cancel adding expense type"
                              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:opacity-50"
                            >
                              <X size={16} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          id="fixed-description"
                          {...register('description')}
                          aria-invalid={!!errors.description}
                          className={`min-h-11 w-full appearance-none rounded-xl border bg-slate-50 px-3 pr-10 text-sm text-slate-800 outline-none transition-shadow focus:border-purple-400 focus:ring-2 focus:ring-purple-100 ${errors.description ? 'border-rose-400' : 'border-slate-200'}`}
                        >
                          <option value="">Select expense type...</option>
                          {fixedCostItems.map((item) => (
                            <option key={item.id} value={item.name}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={16}
                          aria-hidden="true"
                          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        {errors.description && (
                          <p className="mt-1.5 text-xs text-rose-600" role="alert">
                            {errors.description.message}
                          </p>
                        )}
                        {fixedCostItems.length === 0 && (
                          <p className="mt-2 text-xs text-slate-500">
                            No saved expense types yet. Choose{' '}
                            <span className="font-semibold text-purple-700">Add type</span> to
                            create one.
                          </p>
                        )}
                      </div>
                    )}
                  </section>
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label
                        htmlFor="fixed-details"
                        className="text-sm font-semibold text-slate-800"
                      >
                        Description <span className="font-normal text-slate-400">(optional)</span>
                      </label>
                      <span className="text-[11px] tabular-nums text-slate-400">
                        {expenseDetails.length}/240
                      </span>
                    </div>
                    <textarea
                      id="fixed-details"
                      value={expenseDetails}
                      onChange={(e) => setExpenseDetails(e.target.value.slice(0, 240))}
                      maxLength={240}
                      rows={3}
                      placeholder="Add a short note, such as the billing period or payment reference."
                      className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition-shadow placeholder:text-slate-400 focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="fixed-amount"
                      className="mb-2 block text-sm font-semibold text-slate-800"
                    >
                      Total cost <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                        ৳
                      </span>
                      <input
                        id="fixed-amount"
                        type="number"
                        inputMode="decimal"
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        {...register('amount')}
                        aria-invalid={!!errors.amount}
                        className={`min-h-11 w-full rounded-xl border bg-slate-50 pl-8 pr-3 text-sm font-semibold tabular-nums text-slate-900 outline-none transition-shadow focus:border-purple-400 focus:ring-2 focus:ring-purple-100 ${errors.amount ? 'border-rose-400' : 'border-slate-200'}`}
                      />
                    </div>
                    {errors.amount && (
                      <p className="mt-1.5 text-xs text-rose-600" role="alert">
                        {errors.amount.message}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="fixed-method"
                        className="mb-2 block text-sm font-semibold text-slate-800"
                      >
                        Paid via
                      </label>
                      <div className="relative">
                        <select
                          id="fixed-method"
                          {...register('method')}
                          className="min-h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 pr-9 text-sm text-slate-800 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                        >
                          <option value="cash">Cash</option>
                          <option value="bank">Bank</option>
                          <option value="bkash">bKash</option>
                        </select>
                        <ChevronDown
                          size={16}
                          aria-hidden="true"
                          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                      </div>
                    </div>
                    <div>
                      <label
                        htmlFor="fixed-date"
                        className="mb-2 block text-sm font-semibold text-slate-800"
                      >
                        Payment date
                      </label>
                      <input
                        id="fixed-date"
                        type="date"
                        value={costDate}
                        max={todayISO()}
                        onChange={(e) => setCostDate(e.target.value)}
                        className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                      />
                    </div>
                  </div>
                </div>
                <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
                  <ButtonLoading
                    loading={isSubmitting}
                    type="submit"
                    className="flex min-h-12 w-full items-center justify-center rounded-xl bg-purple-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-purple-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Save Expense
                  </ButtonLoading>
                </div>
              </form>
            )}
          </aside>
        </div>
      )}

      {/* ── Summary + History Panel ─────────────────────────────────────── */}
      <div className="min-w-0 space-y-4 sm:space-y-5">
        {/* ── History Log ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 md:px-6 py-4 bg-slate-50/60 border-b border-slate-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-bold text-slate-700 text-sm">Fixed Expense History</h3>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                  All fixed expense entries
                </p>
              </div>
              {canMutate && (
                <button
                  type="button"
                  onClick={() => setShowEntryDrawer(true)}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-purple-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2"
                >
                  <Plus size={16} aria-hidden="true" /> Add Expense
                </button>
              )}
            </div>
            {/* Compact history toolbar */}
            <div className="flex flex-col space-y-3">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                {/* Search */}
                <div className="relative w-full xl:max-w-xs">
                  <Search
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                  <input
                    type="text"
                    placeholder="Search descriptions…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-9 py-2.5 sm:py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-200"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                {/* Date range, clear filters, and export */}
                <div className="flex w-full flex-wrap items-center gap-2 sm:gap-3 xl:w-auto xl:justify-end">
                  <div className="min-w-0 max-w-full shrink-0">
                    <RangeCalendar
                      value={customDateRange}
                      onRangeChange={setCustomDateRange}
                      align="right"
                    />
                  </div>

                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setMethodFilter('all');
                      }}
                      className="text-[11px] sm:text-xs font-semibold text-slate-500 hover:text-slate-700 underline underline-offset-2 transition-colors"
                    >
                      Clear filters
                    </button>
                  )}
                  <div className="shrink-0">
                    <ExportDropdown
                      config={exportConfig}
                      disabled={filteredExpenses.length === 0}
                    />
                  </div>
                </div>
              </div>

              {/* Payment method and view controls */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {(['all', 'cash', 'bank', 'bkash'] as const).map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setMethodFilter(val)}
                      className={`px-3 sm:px-2.5 py-1.5 sm:py-1 text-[11px] font-bold rounded-md transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${
                        methodFilter === val
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {val === 'all'
                        ? 'All Methods'
                        : val === 'bkash'
                          ? 'bKash'
                          : val.charAt(0).toUpperCase() + val.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="sr-only">View</span>
                  <button
                    type="button"
                    onClick={() => setHistoryView('table')}
                    aria-pressed={historyView === 'table'}
                    className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 ${historyView === 'table' ? 'border-purple-200 bg-purple-50 text-purple-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    <List size={14} />
                    Table
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryView('grid')}
                    aria-pressed={historyView === 'grid'}
                    className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 ${historyView === 'grid' ? 'border-purple-200 bg-purple-50 text-purple-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    <LayoutGrid size={14} />
                    Grid
                  </button>
                </div>
              </div>
            </div>
            {/* Results summary */}
            {hasActiveFilters && (
              <p className="text-[11px] text-slate-500 mt-3 pt-3 border-t border-slate-200/60">
                Showing <span className="font-bold text-slate-700">{filteredExpenses.length}</span>{' '}
                of <span className="font-bold text-slate-700">{fixedExpenses.length}</span> entries
              </p>
            )}
          </div>
          {historyView === 'table' ? (
            <>
              <div className="divide-y divide-slate-100 md:hidden">
                {paginatedExpenses.length > 0 ? (
                  paginatedExpenses.map((t) => (
                    <article key={t.id} className="flex items-start justify-between gap-3 p-4">
                      <div className="min-w-0 space-y-2">
                        <div>
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {getExpenseDescriptionParts(t.description).name}
                          </p>
                          {getExpenseDescriptionParts(t.description).details && (
                            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                              {getExpenseDescriptionParts(t.description).details}
                            </p>
                          )}
                          <p className="mt-0.5 text-xs text-slate-500">
                            {t.date?.toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                        <MethodBadge method={t.method ?? 'cash'} />
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className="text-sm font-extrabold tabular-nums text-purple-700">
                          -{formatCurrency(t.amount)} ৳
                        </span>
                        {isOwner && (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => handleManagerEdit(t)}
                              aria-label={`Edit transaction: ${t.description}`}
                              className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                            >
                              <Pencil size={14} aria-hidden="true" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleManagerDelete(t.id)}
                              aria-label={`Delete transaction: ${t.description}`}
                              className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="py-12 text-center text-sm text-slate-500">
                    No fixed expenses found for the selected period.
                  </div>
                )}
              </div>
              <div className="hidden overflow-hidden md:block">
                {' '}
                <table className="w-full table-fixed text-left">
                  <thead className="bg-slate-50 border-b-2 border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 sm:px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 sm:px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-4 sm:px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Via
                      </th>
                      <th className="px-4 sm:px-5 py-3.5 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Cost
                      </th>
                      {/* Actions Header only renders for Owners */}
                      {isOwner && (
                        <th className="px-4 sm:px-5 py-3.5 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedExpenses.length > 0 ? (
                      paginatedExpenses.map((t) => (
                        <tr key={t.id} className="hover:bg-purple-50/40 transition-colors group">
                          <td className="px-4 sm:px-5 py-3 sm:py-3.5 text-xs font-medium text-slate-600 whitespace-nowrap">
                            {t.date?.toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="px-4 sm:px-5 py-3 sm:py-3.5 max-w-[200px]">
                            <span className="text-sm font-semibold text-slate-700 block truncate">
                              {getExpenseDescriptionParts(t.description).name}
                            </span>
                            {getExpenseDescriptionParts(t.description).details && (
                              <span className="mt-0.5 block truncate text-xs text-slate-500">
                                {getExpenseDescriptionParts(t.description).details}
                              </span>
                            )}
                          </td>
                          <td className="px-4 sm:px-5 py-3 sm:py-3.5">
                            <MethodBadge method={t.method ?? 'cash'} />
                          </td>
                          <td className="px-4 sm:px-5 py-3 sm:py-3.5 text-right">
                            <span className="text-sm font-extrabold text-purple-700 tabular-nums whitespace-nowrap">
                              -{formatCurrency(t.amount)} ৳
                            </span>
                          </td>
                          {/* Edit/Delete Actions only render for Owners */}
                          {isOwner && (
                            <td className="px-4 sm:px-5 py-3 sm:py-3.5 text-right">
                              <div className="flex gap-1.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity justify-end">
                                <button
                                  onClick={() => handleManagerEdit(t)}
                                  className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-slate-50 px-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 lg:bg-transparent transition-colors"
                                >
                                  <Pencil size={14} aria-hidden="true" /> Edit
                                </button>
                                <button
                                  onClick={() => handleManagerDelete(t.id)}
                                  className="p-2 sm:p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 bg-slate-50 lg:bg-transparent rounded-lg transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        {/* Conditionally shift colSpan if the Actions column is missing */}
                        <td colSpan={isOwner ? 5 : 4} className="px-4 py-16 sm:py-20 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                              <Building2 size={28} className="text-slate-300" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-600">
                                No fixed expenses found
                              </p>
                              <p className="text-xs text-slate-400 mt-1 max-w-[200px] mx-auto leading-relaxed">
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
            </>
          ) : (
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {paginatedExpenses.length > 0 ? (
                paginatedExpenses.map((t) => (
                  <article
                    key={t.id}
                    className="flex min-w-0 flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-purple-200 hover:bg-purple-50/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {getExpenseDescriptionParts(t.description).name}
                        </p>
                        {getExpenseDescriptionParts(t.description).details && (
                          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                            {getExpenseDescriptionParts(t.description).details}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-slate-500">
                          {t.date?.toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-extrabold tabular-nums text-purple-700">
                        -{formatCurrency(t.amount)} ৳
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <MethodBadge method={t.method ?? 'cash'} />
                      {isOwner && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleManagerEdit(t)}
                            aria-label={`Edit transaction: ${t.description}`}
                            className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                          >
                            <Pencil size={14} aria-hidden="true" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleManagerDelete(t.id)}
                            aria-label={`Delete transaction: ${t.description}`}
                            className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <div className="col-span-full py-12 text-center text-sm text-slate-500">
                  No fixed expenses found for the selected period.
                </div>
              )}
            </div>
          )}
          {/* Table Footer with Pagination */}
          {filteredExpenses.length > 0 && (
            <div className="px-4 sm:px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-xs text-slate-500 w-full text-center md:text-left">
                <span className="font-bold text-slate-700">{filteredExpenses.length}</span> entr
                {filteredExpenses.length !== 1 ? 'ies' : 'y'} ·{' '}
                <span className="font-bold text-purple-700">{formatCurrency(filteredTotal)} ৳</span>{' '}
                total
              </p>
              <div className="w-full md:w-auto">
                <Pagination pagination={pagination} showPageInfo={false} />
              </div>
            </div>
          )}
        </div>
        <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3.5 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 sm:px-5">
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-800">
                Insights and breakdown
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Category and payment method totals
              </span>
            </span>
            <ChevronDown
              size={17}
              className="shrink-0 text-slate-500 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="border-t border-slate-200 p-3 sm:p-4">
            {/* ── Summary Card ─────────────────────────────────────────────── */}
            <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
              <div className="p-4 md:p-6 bg-gradient-to-r from-purple-50 via-white to-slate-50 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 sm:mb-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 sm:p-2.5 bg-purple-100 rounded-lg sm:rounded-xl text-purple-600 shadow-sm shrink-0">
                      <Building2 size={20} className="sm:w-5 sm:h-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">
                        Fixed Expense Summary
                      </h3>
                      <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                        Fixed expenses overview
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 bg-purple-600 text-white px-4 py-2.5 sm:py-3 rounded-xl shadow-sm sm:shadow-md sm:shadow-purple-200 w-full sm:w-auto text-center sm:text-right">
                    <p className="text-[10px] sm:text-xs font-bold text-purple-200 uppercase tracking-widest leading-none mb-1">
                      Total
                    </p>
                    <p className="text-xl sm:text-2xl font-extrabold tabular-nums">
                      {formatCurrency(stats.totalFixedCost)} ৳
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  <MiniStat
                    label="Entries"
                    value={fixedExpenses.length.toString()}
                    icon={Hash}
                    iconColor="text-purple-600"
                    iconBg="bg-purple-100"
                  />
                  <MiniStat
                    label="Categories"
                    value={categoryBreakdown.length.toString()}
                    icon={Layers}
                    iconColor="text-indigo-600"
                    iconBg="bg-indigo-100"
                  />
                  <div className="col-span-2 sm:col-span-1">
                    <MiniStat
                      label="Largest Entry"
                      value={`${formatCurrency(largestEntry)} ৳`}
                      icon={Building2}
                      iconColor="text-rose-500"
                      iconBg="bg-rose-50"
                      valueColor="text-rose-600"
                    />
                  </div>
                </div>
              </div>
              <div className="p-4 md:p-6 space-y-5">
                {/* Category breakdown (Dynamic + Paginated) */}
                {categoryBreakdown.length > 0 ? (
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                      By Category
                    </h4>
                    <div className="space-y-3">
                      {paginatedCategories.map((item) => {
                        // Calculate percentage based strictly on the filtered total matching the visual rows
                        const pct =
                          filteredTotal > 0 ? Math.round((item.amount / filteredTotal) * 100) : 0;
                        return (
                          <div key={item.name}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                                <span className="text-xs sm:text-sm font-semibold text-slate-700 truncate">
                                  {item.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                                <span className="text-xs sm:text-sm font-extrabold text-purple-700 tabular-nums">
                                  {formatCurrency(item.amount)} ৳
                                </span>
                                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 w-8 text-right">
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
                    {/* Embedded pagination solely for the breakdown container */}
                    {categoryBreakdown.length > 5 && (
                      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <Pagination pagination={categoryPagination} showPageInfo={false} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center text-slate-400 text-sm">
                    No fixed expenses recorded for this period.
                  </div>
                )}
                {/* Payment method split */}
                {filteredExpenses.length > 0 && (
                  <>
                    <div className="border-t border-slate-100" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                        Payment Methods
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {(
                          Object.entries(METHOD_CONFIG) as [
                            string,
                            (typeof METHOD_CONFIG)[string],
                          ][]
                        ).map(([key, cfg]) => {
                          const amount = fixedByMethod[key as keyof typeof fixedByMethod];
                          const pct =
                            filteredTotal > 0 ? Math.round((amount / filteredTotal) * 100) : 0;
                          return (
                            <div
                              key={key}
                              className={`p-3.5 sm:p-4 rounded-xl border ${cfg.border} ${cfg.bg} flex flex-col gap-2`}
                            >
                              <div className="flex items-center justify-between sm:justify-start gap-2">
                                <div className="flex items-center gap-2">
                                  <cfg.icon size={14} className={cfg.color} />
                                  <span className={`text-xs font-bold ${cfg.color}`}>
                                    {cfg.label}
                                  </span>
                                </div>
                                <span className="sm:hidden text-sm font-extrabold text-slate-800 tabular-nums">
                                  {formatCurrency(amount)} ৳
                                </span>
                              </div>
                              <p className="hidden sm:block text-base font-extrabold text-slate-800 tabular-nums mt-1">
                                {formatCurrency(amount)} ৳
                              </p>
                              <div className="flex items-center gap-2 mt-1 sm:mt-0">
                                <div className="flex-1 h-1.5 bg-white/60 rounded-full overflow-hidden">
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
                                <span className="text-[10px] font-bold text-slate-500 w-6 text-right">
                                  {pct}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
