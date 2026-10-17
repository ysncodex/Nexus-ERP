/**
 * Consumables & Packaging — cups, lids, bags, boxes, napkins, straws, and other
 * packing supplies.
 *
 * Mirrors the Purchases page so cafe staff who already know that screen know
 * this one: pick a group + item from the saved catalog (or create one inline),
 * type the total amount paid and quantity, and the unit cost is derived.
 *
 * Why this page exists:
 *   • Keep packaging out of ingredient Purchases so Gross Profit stays
 *     Sales − COGS without inflating with cups and lids.
 *   • Keep packaging out of Fixed Expenses so rent, salaries, and utilities
 *     stay separate from variable packaging spend that scales with sales.
 */
import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Banknote,
  Boxes,
  ChevronDown,
  Landmark,
  Layers,
  Pencil,
  Plus,
  Search,
  Smartphone,
  Trash2,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useERP } from '@/core/context/useERP';
import { DEFAULT_CONSUMABLE_GROUPS, type Transaction, type UnitType } from '@/core/types';
import {
  EditTransactionModal,
  ManageListModal,
  ManagerPasswordModal,
  Pagination,
} from '@/shared/components/ui';
import { useCanMutate, useClientPagination } from '@/shared/hooks';
import {
  consumableSchema,
  formatCurrency,
  handleError,
  type ConsumableFormData,
} from '@/shared/utils';
import { parseBusinessDate, todayBusinessKey } from '@/shared/utils/businessDate';
import { ExportDropdown, TRANSACTION_EXPORT_COLUMNS } from '@/shared/export';
import RangeCalendar from '@/shared/components/ui/Calendar/CustomCalendar';

// ─── Constants ────────────────────────────────────────────────────────────────

const NOTE_SEPARATOR = '\n[Note] ';

const UNIT_OPTIONS: { value: UnitType; label: string }[] = [
  { value: 'pcs', label: 'Pcs' },
  { value: 'box', label: 'Box' },
  { value: 'pack', label: 'Pack' },
  { value: 'kg', label: 'Kg' },
  { value: 'g', label: 'g' },
  { value: 'L', label: 'L' },
  { value: 'ml', label: 'ml' },
];

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'bkash', label: 'bKash' },
] as const;

const METHOD_CONFIG: Record<
  string,
  { label: string; icon: LucideIcon; color: string; bg: string }
> = {
  cash: { label: 'Cash', icon: Banknote, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  bank: { label: 'Bank', icon: Landmark, color: 'text-blue-600', bg: 'bg-blue-50' },
  bkash: { label: 'bKash', icon: Smartphone, color: 'text-pink-600', bg: 'bg-pink-50' },
};

const LABEL_CLASS = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-600';

const EMPTY_FORM: ConsumableFormData = {
  group: '',
  item: '',
  supplier: '',
  cost: '',
  quantity: '',
  unit: 'pcs',
  unitPrice: '',
  method: 'cash',
  note: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function money(amount: number): string {
  return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function splitDescription(value: string): { name: string; note: string } {
  const cut = value.indexOf(NOTE_SEPARATOR);
  if (cut < 0) return { name: value, note: '' };
  return { name: value.slice(0, cut), note: value.slice(cut + NOTE_SEPARATOR.length) };
}

// ─── Reusable sub-components (ProductCosts parity) ────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-xs text-rose-600">
      {message}
    </p>
  );
}

interface SelectWithChevronProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

const SelectWithChevron = forwardRef<HTMLSelectElement, SelectWithChevronProps>(
  ({ hasError, className = '', children, ...props }, ref) => (
    <div className="relative">
      <select
        {...props}
        ref={ref}
        className={`h-10 w-full cursor-pointer appearance-none rounded-xl border pl-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-teal-500 ${hasError ? 'border-rose-400' : 'border-slate-200'} ${className}`}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 z-10 -translate-y-1/2 text-slate-400"
      />
    </div>
  )
);
SelectWithChevron.displayName = 'SelectWithChevron';

/** Label row for the Group / Item pickers: compact so it fits a half-width column. */
interface PickerLabelProps {
  htmlFor: string;
  label: string;
  manageTitle: string;
  newTitle: string;
  onManage: () => void;
  onNew: () => void;
  showNew: boolean;
}

function PickerLabel({
  htmlFor,
  label,
  manageTitle,
  newTitle,
  onManage,
  onNew,
  showNew,
}: PickerLabelProps) {
  return (
    <div className="mb-1.5 flex min-h-7 items-center justify-between gap-2">
      <label
        htmlFor={htmlFor}
        className="text-[11px] font-semibold uppercase tracking-wide text-slate-600"
      >
        {label} <span className="text-rose-600">*</span>
      </label>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onManage}
          title={manageTitle}
          aria-label={manageTitle}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-teal-50 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        >
          <Pencil size={13} />
        </button>
        {showNew && (
          <button
            type="button"
            onClick={onNew}
            title={newTitle}
            aria-label={newTitle}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2 text-[11px] font-semibold text-teal-800 transition-colors hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            <Plus size={12} /> New
          </button>
        )}
      </div>
    </div>
  );
}

interface InlineAddFieldProps {
  value: string;
  onChange: (value: string) => void;
  onAdd: () => void | Promise<void>;
  onCancel: () => void;
  placeholder: string;
  loading?: boolean;
  heading: string;
  description: string;
  inputId: string;
}

/** Compact one-row creator (input + Save + close) so it replaces a select without growing the form. */
function InlineAddField({
  value,
  onChange,
  onAdd,
  onCancel,
  placeholder,
  loading,
  heading,
  description,
  inputId,
}: InlineAddFieldProps) {
  const handleAdd = () => {
    void Promise.resolve(onAdd());
  };
  return (
    <div
      role="group"
      aria-label={heading}
      className="rounded-xl border border-teal-200 bg-teal-50/70 p-1.5"
    >
      <p className="sr-only">{heading}</p>
      <p id={`${inputId}-help`} className="sr-only">
        {description}
      </p>
      <label htmlFor={inputId} className="sr-only">
        {placeholder}
      </label>
      <div className="flex gap-1.5">
        <input
          id={inputId}
          type="text"
          autoFocus
          placeholder={placeholder}
          title={description}
          aria-describedby={`${inputId}-help`}
          value={value}
          disabled={loading}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
            if (e.key === 'Escape') {
              // Close only the inline creator, not the whole drawer.
              e.stopPropagation();
              onCancel();
            }
          }}
          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-200 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={loading || !value.trim()}
          className="inline-flex h-9 items-center justify-center rounded-lg bg-teal-700 px-3 text-xs font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        >
          {loading ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          aria-label="Cancel"
          title="Cancel"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Consumables() {
  const canMutate = useCanMutate();
  const {
    filteredTransactions,
    addTransaction,
    deleteTransaction,
    updateTransaction,
    consumableGroups,
    consumableItems,
    suppliers,
    addConsumableGroup,
    renameConsumableGroup,
    deleteConsumableGroup,
    addConsumableItem,
    renameConsumableItem,
    deleteConsumableItem,
    customDateRange,
    setCustomDateRange,
    fundBalances,
  } = useERP();

  // The server catalog is the source of truth. We fall back to the default
  // seed list only until the first fetch returns (fresh install or offline).
  const groupNames = useMemo(() => {
    if (consumableGroups.length) return consumableGroups.map((g) => g.name);
    return [...DEFAULT_CONSUMABLE_GROUPS];
  }, [consumableGroups]);

  // ── Drawer / form state ────────────────────────────────────────────────────
  const [showEntry, setShowEntry] = useState(false);
  const [costDate, setCostDate] = useState(todayBusinessKey);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  const [manageGroups, setManageGroups] = useState(false);
  const [manageItems, setManageItems] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<'all' | 'cash' | 'bank' | 'bkash'>('all');

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordTitle, setPasswordTitle] = useState('');
  const [pendingAction, setPendingAction] = useState<(() => void | Promise<void>) | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
  } = useForm<ConsumableFormData>({
    resolver: zodResolver(consumableSchema),
    defaultValues: EMPTY_FORM,
  });

  // Auto-calculate the unit price from total amount paid ÷ quantity, same
  // pattern as Purchases so the two pages feel consistent.
  const watchedCost = useWatch({ control, name: 'cost' });
  const watchedQty = useWatch({ control, name: 'quantity' });
  useEffect(() => {
    const totalCost = parseFloat(watchedCost || '0');
    const qty = parseFloat(watchedQty || '0');
    if (Number.isFinite(totalCost) && Number.isFinite(qty) && qty > 0 && totalCost > 0) {
      setValue('unitPrice', (totalCost / qty).toFixed(2), { shouldValidate: false });
    } else {
      setValue('unitPrice', '', { shouldValidate: false });
    }
  }, [watchedCost, watchedQty, setValue]);

  // Warn before saving when the chosen account can't cover the purchase. The
  // backend enforces this too; this is just early, specific feedback so the
  // user doesn't lose a filled-in form to a rejected request.
  const watchedMethod = useWatch({ control, name: 'method' });
  const availableBalance = useMemo(
    () => (fundBalances ? fundBalances.combined[watchedMethod] : null),
    [fundBalances, watchedMethod]
  );
  const plannedCost = useMemo(() => {
    const value = parseFloat(watchedCost || '0');
    return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : 0;
  }, [watchedCost]);
  const shortfall = useMemo(() => {
    if (availableBalance === null || plannedCost <= 0) return 0;
    const diff = Math.round((plannedCost - availableBalance) * 100) / 100;
    return diff > 0 ? diff : 0;
  }, [availableBalance, plannedCost]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const rows = useMemo(
    () => filteredTransactions.filter((t) => t.type === 'expense_consumable'),
    [filteredTransactions]
  );

  const groupTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const row of rows) {
      const key = row.category && row.category.trim() ? row.category : 'Other';
      totals[key] = (totals[key] ?? 0) + Number(row.amount);
    }
    return totals;
  }, [rows]);

  const periodTotal = useMemo(() => rows.reduce((sum, r) => sum + Number(r.amount), 0), [rows]);

  const filtered = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      const { name, note } = splitDescription(row.description);
      if (groupFilter !== 'all' && row.category !== groupFilter) return false;
      if (methodFilter !== 'all' && row.method !== methodFilter) return false;
      if (!term) return true;
      return `${name} ${note} ${row.supplier ?? ''} ${row.category ?? ''}`
        .toLowerCase()
        .includes(term);
    });
  }, [rows, searchQuery, groupFilter, methodFilter]);

  const filteredTotal = useMemo(
    () => filtered.reduce((sum, r) => sum + Number(r.amount), 0),
    [filtered]
  );

  const { paginatedData, pagination } = useClientPagination(filtered, {
    initialPageSize: 10,
    pageSizeOptions: [10, 20, 50],
  });

  const consumableItemNames = useMemo(() => consumableItems.map((i) => i.name), [consumableItems]);
  const supplierNames = useMemo(() => suppliers.map((s) => s.name), [suppliers]);

  const exportConfig = useMemo(
    () => ({
      filenameBase: 'consumables_packaging',
      title: 'Consumables & Packaging',
      subtitle: 'Cups, lids, bags, boxes, napkins, straws, and other packing supplies',
      columns: TRANSACTION_EXPORT_COLUMNS,
      sheetName: 'Consumables',
      getData: () => filtered,
      summaryRows: filtered.length
        ? ([['TOTAL (৳)', filteredTotal]] as Array<[string, string | number]>)
        : undefined,
    }),
    [filtered, filteredTotal]
  );

  // ── Form handlers ──────────────────────────────────────────────────────────
  const resetForm = useCallback(() => {
    reset(EMPTY_FORM);
    setShowAddGroup(false);
    setNewGroupName('');
    setShowAddItem(false);
    setNewItemName('');
  }, [reset]);

  // Single place that closes the drawer and leaves no stale state behind
  // (half-typed values, open inline creators, an old date).
  const closeEntry = useCallback(() => {
    resetForm();
    setCostDate(todayBusinessKey());
    setShowEntry(false);
  }, [resetForm]);

  // Escape closes the drawer (inline creators handle their own Escape first).
  useEffect(() => {
    if (!showEntry) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeEntry();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showEntry, closeEntry]);

  // Lock page scroll behind the drawer so nothing shifts while it is open.
  useEffect(() => {
    if (!showEntry) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [showEntry]);

  const onSubmit = useCallback(
    (data: ConsumableFormData) => {
      const cost = Math.round(Number(data.cost) * 100) / 100;
      const quantity = Number(data.quantity);
      if (!(cost > 0) || !(quantity > 0)) {
        toast.error('Enter a positive amount and quantity.');
        return;
      }
      if (!costDate) {
        toast.error('Choose a date.');
        return;
      }
      if (shortfall > 0) {
        toast.error('Not enough money in the selected account for this purchase.');
        return;
      }
      // Derive unit price from cost ÷ qty server-side to avoid rounding gaps.
      const unitPrice = Math.round((cost / quantity) * 100) / 100;
      const note = data.note?.trim();
      try {
        addTransaction({
          type: 'expense_consumable',
          category: data.group,
          amount: cost,
          method: data.method,
          description: note ? `${data.item}${NOTE_SEPARATOR}${note}` : data.item,
          quantity,
          unit: data.unit,
          unitPrice,
          supplier: data.supplier.trim(),
          date: parseBusinessDate(costDate),
        });
        toast.success('Consumable recorded');
        closeEntry();
      } catch (error) {
        handleError(error, { action: 'add_consumable', severity: 'high' });
      }
    },
    [addTransaction, closeEntry, costDate, shortfall]
  );

  const saveNewGroup = useCallback(async () => {
    const name = newGroupName.trim();
    if (!name) {
      toast.error('Enter a group name');
      return;
    }
    setAddingGroup(true);
    try {
      await addConsumableGroup(name);
      setValue('group', name, { shouldValidate: true });
      setNewGroupName('');
      setShowAddGroup(false);
      toast.success('Group saved');
    } catch (error) {
      handleError(error, { action: 'add_consumable_group', severity: 'medium' });
      toast.error('Could not save group — check you are signed in as owner or manager');
    } finally {
      setAddingGroup(false);
    }
  }, [addConsumableGroup, newGroupName, setValue]);

  const saveNewItem = useCallback(async () => {
    const name = newItemName.trim();
    if (!name) {
      toast.error('Enter an item name');
      return;
    }
    setAddingItem(true);
    try {
      await addConsumableItem(name);
      setValue('item', name, { shouldValidate: true });
      setNewItemName('');
      setShowAddItem(false);
      toast.success('Item saved');
    } catch (error) {
      handleError(error, { action: 'add_consumable_item', severity: 'medium' });
      toast.error('Could not save item — check you are signed in as owner or manager');
    } finally {
      setAddingItem(false);
    }
  }, [addConsumableItem, newItemName, setValue]);

  const askOwner = useCallback((title: string, action: () => void | Promise<void>) => {
    setPasswordTitle(title);
    setPendingAction(() => action);
    setPasswordOpen(true);
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-w-0 space-y-4 pb-20 sm:pb-6">
      {/* Group totals strip — doubles as a quick filter. */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        <button
          type="button"
          onClick={() => setGroupFilter('all')}
          className={`rounded-xl border p-3 text-left transition-colors ${groupFilter === 'all' ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">All groups</p>
          <p className="mt-1 text-sm font-extrabold tabular-nums text-slate-800">
            {money(periodTotal)} ৳
          </p>
        </button>
        {groupNames.map((group) => (
          <button
            key={group}
            type="button"
            onClick={() => setGroupFilter(group)}
            className={`rounded-xl border p-3 text-left transition-colors ${groupFilter === group ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
          >
            <p className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {group}
            </p>
            <p className="mt-1 text-sm font-extrabold tabular-nums text-slate-800">
              {money(groupTotals[group] ?? 0)} ৳
            </p>
          </button>
        ))}
      </section>

      {/* Records */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 p-4 sm:p-5">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Consumables & Packaging</h2>
            <p className="mt-1 text-xs text-slate-500">
              Serving and packing supplies. Kept out of ingredient purchases and fixed expenses.
            </p>
          </div>
          {canMutate && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setManageGroups(true)}
                className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Layers size={14} /> Manage groups
              </button>
              <button
                type="button"
                onClick={() => setManageItems(true)}
                className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Pencil size={14} /> Manage items
              </button>
              <button
                type="button"
                onClick={() => setShowEntry(true)}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700"
              >
                <Plus size={16} /> Record purchase
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-xs">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-3 text-slate-400"
            />
            <input
              aria-label="Search consumables"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search item, note, or supplier…"
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter group"
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All groups</option>
              {groupNames.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter payment method"
              value={methodFilter}
              onChange={(event) => setMethodFilter(event.target.value as typeof methodFilter)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All methods</option>
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="bkash">bKash</option>
            </select>
            <RangeCalendar
              value={customDateRange}
              onRangeChange={setCustomDateRange}
              align="right"
            />
            <ExportDropdown config={exportConfig} disabled={filtered.length === 0} />
          </div>
        </div>

        {paginatedData.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-2 p-6 text-center">
            <div className="rounded-2xl bg-teal-50 p-4 text-teal-500">
              <Boxes size={26} />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">No consumables in this period</h3>
            <p className="max-w-sm text-xs text-slate-500">
              Record cups, lids, bags, boxes, napkins, or straws. Ingredient purchases stay on
              Purchases, and rent or salaries stay on Fixed Expenses.
            </p>
          </div>
        ) : (
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full min-w-[860px] text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  {[
                    'Date',
                    'Group',
                    'Item',
                    'Qty',
                    'Unit cost',
                    'Supplier',
                    'Paid from',
                    'Amount',
                    'Actions',
                  ].map((label) => (
                    <th
                      key={label}
                      className={`px-4 py-3 ${label === 'Amount' || label === 'Unit cost' || label === 'Qty' || label === 'Actions' ? 'text-right' : ''}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedData.map((row) => {
                  const { name, note } = splitDescription(row.description);
                  const method = METHOD_CONFIG[row.method ?? ''];
                  const MethodIcon = method?.icon;
                  return (
                    <tr key={row.id} className="hover:bg-teal-50/30">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {row.date.toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md border border-teal-200 bg-teal-50 px-2 py-1 text-[11px] font-semibold text-teal-800">
                          {row.category || 'Other'}
                        </span>
                      </td>
                      <td className="max-w-[220px] px-4 py-3">
                        <p className="truncate font-semibold text-slate-800">{name}</p>
                        {note && (
                          <p className="mt-0.5 truncate text-[11px] text-slate-400">{note}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-600">
                        {row.quantity ?? '—'} {row.unit ?? ''}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-600">
                        {row.unitPrice != null ? `${money(row.unitPrice)} ৳` : '—'}
                      </td>
                      <td className="max-w-[140px] truncate px-4 py-3 text-slate-500">
                        {row.supplier || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {method ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold ${method.bg} ${method.color}`}
                          >
                            {MethodIcon && <MethodIcon size={12} />} {method.label}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-slate-800">
                        {money(Number(row.amount))} ৳
                      </td>
                      <td className="px-4 py-3">
                        {canMutate && (
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              aria-label={`Edit ${name}`}
                              onClick={() => askOwner('Edit consumable', () => setEditing(row))}
                              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${name}`}
                              onClick={() =>
                                askOwner('Delete consumable', async () => {
                                  try {
                                    await deleteTransaction(row.id);
                                    toast.success('Consumable deleted');
                                  } catch (error) {
                                    handleError(error, {
                                      action: 'delete_consumable',
                                      severity: 'high',
                                    });
                                  }
                                })
                              }
                              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:text-rose-600"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/60 px-4 py-3">
          <p className="text-xs text-slate-500">
            <strong className="text-slate-700">{filtered.length}</strong> records ·{' '}
            <strong className="text-teal-700">{money(filteredTotal)} ৳</strong>
          </p>
          {filtered.length > 0 && <Pagination pagination={pagination} />}
        </footer>
      </section>

      {/* Manage modals */}
      <ManageListModal
        isOpen={manageGroups}
        onClose={() => setManageGroups(false)}
        title="Manage Consumable Groups"
        items={consumableGroups.map((g) => g.name)}
        emptyText="No groups saved yet. Use “New group” on the record form to add one."
        onRename={renameConsumableGroup}
        onDelete={deleteConsumableGroup}
      />
      <ManageListModal
        isOpen={manageItems}
        onClose={() => setManageItems(false)}
        title="Manage Consumable Items"
        items={consumableItemNames}
        emptyText="No items saved yet. Use “New item” on the record form to add one."
        onRename={renameConsumableItem}
        onDelete={deleteConsumableItem}
      />

      {/* Entry drawer — sized to fit the viewport height; scrolls only on very short screens. */}
      {showEntry &&
        canMutate &&
        createPortal(
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              aria-label="Close consumable form"
              onClick={closeEntry}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]"
            />
            <aside
              role="dialog"
              aria-modal="true"
              aria-labelledby="consumable-drawer-title"
              className="absolute inset-y-0 right-0 flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl"
            >
              <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-700">
                    Consumables & Packaging
                  </p>
                  <h2
                    id="consumable-drawer-title"
                    className="mt-0.5 text-base font-bold text-slate-900 sm:text-lg"
                  >
                    Record consumable
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Group, item, supplier, and quantity are required. Unit cost calculates from the
                    amount paid.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={closeEntry}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                >
                  <X size={18} />
                </button>
              </header>

              <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-3 [scrollbar-width:thin] sm:px-6 sm:py-4">
                  {/* Group | Item */}
                  <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
                    <div className="min-w-0">
                      <PickerLabel
                        htmlFor="consumable-group"
                        label="Group"
                        manageTitle="Manage groups"
                        newTitle="New group"
                        onManage={() => setManageGroups(true)}
                        onNew={() => setShowAddGroup(true)}
                        showNew={!showAddGroup}
                      />
                      {showAddGroup ? (
                        <InlineAddField
                          inputId="consumable-group-new"
                          heading="Create a group"
                          description="e.g. “Takeaway containers”, “Trays”. The saved group will be selected for this purchase."
                          placeholder="New group name..."
                          value={newGroupName}
                          onChange={setNewGroupName}
                          onAdd={saveNewGroup}
                          onCancel={() => {
                            setShowAddGroup(false);
                            setNewGroupName('');
                          }}
                          loading={addingGroup}
                        />
                      ) : (
                        <>
                          <SelectWithChevron
                            id="consumable-group"
                            hasError={!!errors.group}
                            className="bg-slate-50"
                            title="This is how the cost is separated. Not an ingredient purchase."
                            {...register('group')}
                          >
                            <option value="">Choose a group...</option>
                            {groupNames.map((group) => (
                              <option key={group} value={group}>
                                {group}
                              </option>
                            ))}
                          </SelectWithChevron>
                          <FieldError message={errors.group?.message} />
                        </>
                      )}
                    </div>

                    <div className="min-w-0">
                      <PickerLabel
                        htmlFor="consumable-item"
                        label="Item"
                        manageTitle="Manage items"
                        newTitle="New item"
                        onManage={() => setManageItems(true)}
                        onNew={() => setShowAddItem(true)}
                        showNew={!showAddItem}
                      />
                      {showAddItem ? (
                        <InlineAddField
                          inputId="consumable-item-new"
                          heading="Create an item"
                          description="e.g. “12oz paper cup”. The saved item will be selected for this purchase."
                          placeholder="New item name..."
                          value={newItemName}
                          onChange={setNewItemName}
                          onAdd={saveNewItem}
                          onCancel={() => {
                            setShowAddItem(false);
                            setNewItemName('');
                          }}
                          loading={addingItem}
                        />
                      ) : (
                        <>
                          <SelectWithChevron
                            id="consumable-item"
                            hasError={!!errors.item}
                            className="bg-slate-50"
                            {...register('item')}
                          >
                            <option value="">
                              {consumableItems.length === 0
                                ? 'No saved items — use New'
                                : 'Choose an item...'}
                            </option>
                            {consumableItems.map((item) => (
                              <option key={item.id} value={item.name}>
                                {item.name}
                              </option>
                            ))}
                          </SelectWithChevron>
                          <FieldError message={errors.item?.message} />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Supplier */}
                  <div>
                    <label htmlFor="consumable-supplier" className={LABEL_CLASS}>
                      Supplier <span className="text-rose-600">*</span>
                    </label>
                    <SelectWithChevron
                      id="consumable-supplier"
                      hasError={!!errors.supplier}
                      className="bg-slate-50"
                      {...register('supplier')}
                    >
                      <option value="">
                        {suppliers.length === 0
                          ? 'No saved suppliers — add one on the Suppliers page'
                          : 'Choose a supplier...'}
                      </option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.name}>
                          {supplier.name}
                        </option>
                      ))}
                    </SelectWithChevron>
                    <FieldError message={errors.supplier?.message} />
                  </div>

                  {/* Cost + quantity + unit cost (auto) */}
                  <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <div>
                      <label htmlFor="consumable-cost" className={LABEL_CLASS}>
                        Total Amount Paid (৳) <span className="text-rose-600">*</span>
                      </label>
                      <input
                        id="consumable-cost"
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        placeholder="0.00"
                        {...register('cost')}
                        className={`h-10 w-full rounded-xl border bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 ${errors.cost ? 'border-rose-400' : 'border-teal-300'}`}
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        Type the total amount on the receipt. Unit cost calculates automatically.
                      </p>
                      <FieldError message={errors.cost?.message} />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="min-w-0">
                        <label htmlFor="consumable-qty" className={LABEL_CLASS}>
                          Quantity <span className="text-rose-600">*</span>
                        </label>
                        <input
                          id="consumable-qty"
                          type="number"
                          inputMode="decimal"
                          step="any"
                          min="0"
                          placeholder="0"
                          {...register('quantity')}
                          className={`h-10 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-teal-500 ${errors.quantity ? 'border-rose-400' : 'border-slate-200'}`}
                        />
                        <FieldError message={errors.quantity?.message} />
                      </div>
                      <div className="min-w-0">
                        <label htmlFor="consumable-unit" className={LABEL_CLASS}>
                          Unit
                        </label>
                        <SelectWithChevron
                          id="consumable-unit"
                          className="bg-white"
                          {...register('unit')}
                        >
                          {UNIT_OPTIONS.map(({ value, label }) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </SelectWithChevron>
                      </div>
                      <div className="min-w-0">
                        <label
                          htmlFor="consumable-unit-price"
                          className="mb-1.5 block truncate text-[11px] font-semibold uppercase tracking-wide text-emerald-600"
                          title="Unit cost (calculated)"
                        >
                          Unit cost (auto)
                        </label>
                        <input
                          id="consumable-unit-price"
                          type="number"
                          step="any"
                          readOnly
                          tabIndex={-1}
                          placeholder="0.00"
                          {...register('unitPrice')}
                          className="h-10 w-full cursor-not-allowed rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 text-sm font-bold text-emerald-700 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Date | Paid from */}
                  <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
                    <div className="min-w-0">
                      <label htmlFor="consumable-date" className={LABEL_CLASS}>
                        Date <span className="text-rose-600">*</span>
                      </label>
                      <input
                        id="consumable-date"
                        type="date"
                        required
                        value={costDate}
                        onChange={(event) => setCostDate(event.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div className="min-w-0">
                      <label htmlFor="consumable-method" className={LABEL_CLASS}>
                        Paid from
                      </label>
                      <SelectWithChevron
                        id="consumable-method"
                        className="bg-slate-50"
                        {...register('method')}
                      >
                        {PAYMENT_METHODS.map(({ value, label }) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </SelectWithChevron>
                      {/* {availableBalance !== null && (
                        <p className="mt-1 text-[11px] text-slate-500">
                          Available:{' '}
                          <span
                            className={`font-semibold ${shortfall > 0 ? 'text-rose-600' : 'text-slate-700'}`}
                          >
                            {formatCurrency(availableBalance)}
                          </span>
                        </p>
                      )} */}
                    </div>
                  </div>

                  {shortfall > 0 && (
                    <div
                      role="alert"
                      className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-2.5"
                    >
                      <TriangleAlert size={16} className="mt-0.5 shrink-0 text-rose-600" />
                      <div className="text-[11px] leading-relaxed text-rose-800">
                        <p className="font-semibold">Not enough money in this account.</p>
                        <p className="mt-0.5">
                          This purchase needs {formatCurrency(plannedCost)} but only{' '}
                          {formatCurrency(availableBalance ?? 0)} is available — short by{' '}
                          <span className="font-semibold">{formatCurrency(shortfall)}</span>. Add
                          funds or pick another payment method.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Note — standard height; any leftover space stays blank. */}
                  <div>
                    <label htmlFor="consumable-note" className={LABEL_CLASS}>
                      Note (optional)
                    </label>
                    <textarea
                      id="consumable-note"
                      rows={3}
                      {...register('note')}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
                  <button
                    type="submit"
                    disabled={isSubmitting || shortfall > 0}
                    title={shortfall > 0 ? 'Not enough money in the selected account' : undefined}
                    className="h-11 w-full rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2"
                  >
                    {isSubmitting ? 'Saving…' : 'Save Purchase'}
                  </button>
                </footer>
              </form>
            </aside>
          </div>,
          document.body
        )}

      {/* Owner password + edit modal */}
      <ManagerPasswordModal
        isOpen={passwordOpen}
        onClose={() => {
          setPasswordOpen(false);
          setPendingAction(null);
        }}
        onConfirm={() => pendingAction?.()}
        title={passwordTitle}
        requiredRole="owner"
      />
      <EditTransactionModal
        isOpen={editing !== null}
        transaction={editing}
        onClose={() => setEditing(null)}
        onSave={(updated) => {
          updateTransaction(updated);
          toast.success('Consumable updated');
          setEditing(null);
        }}
        itemNames={consumableItemNames}
        suppliers={supplierNames}
      />
    </div>
  );
}
