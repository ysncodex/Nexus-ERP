import {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
  useRef,
  forwardRef,
} from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Package,
  Plus,
  X,
  Pencil,
  Trash2,
  Users,
  ChevronDown,
  Banknote,
  Smartphone,
  Landmark,
  Search,
  Hash,
  TrendingDown,
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
  productCostSchema,
  type ProductCostFormData,
  handleError,
  formatCurrency,
  formatDate,
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

// ─── Constants ────────────────────────────────────────────────────────────────

const UNIT_OPTIONS = [
  { value: 'pcs', label: 'Pcs' },
  { value: 'kg', label: 'Kg' },
  { value: 'g', label: 'g' },
  { value: 'L', label: 'L' },
  { value: 'ml', label: 'ml' },
  { value: 'box', label: 'Box' },
  { value: 'pack', label: 'Pack' },
] as const;

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'bkash', label: 'bKash' },
] as const;

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

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <p className="text-xs text-red-600 mt-1" role="alert">
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
        className={`w-full h-11 pl-3 sm:pl-4 pr-9 border ${
          hasError ? 'border-red-400' : 'border-slate-200'
        } rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 appearance-none text-sm cursor-pointer ${className}`}
      >
        {children}
      </select>

      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 z-10"
      />
    </div>
  )
);

SelectWithChevron.displayName = 'SelectWithChevron';

interface InlineAddFieldProps {
  value: string;

  onChange: (value: string) => void;

  onAdd: () => void | Promise<void>;

  onCancel: () => void;

  placeholder: string;

  loading?: boolean;
}

function InlineAddField({
  value,

  onChange,

  onAdd,

  onCancel,

  placeholder,

  loading,
}: InlineAddFieldProps) {
  const handleAdd = () => {
    void Promise.resolve(onAdd());
  };

  return (
    <div
      id="new-product-item-fields"
      className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 sm:p-4"
    >
      <div className="mb-3">
        <p className="text-sm font-semibold text-slate-800">Create an item</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
          The saved item will be selected for this purchase.
        </p>
      </div>
      <label htmlFor="new-product-item" className="sr-only">
        Item name
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="new-product-item"
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          disabled={loading}
          className="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200 disabled:opacity-60"
          autoFocus
        />
        <div className="flex gap-2 sm:shrink-0">
          <button
            type="button"
            onClick={handleAdd}
            disabled={loading || !value.trim()}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-indigo-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 sm:flex-none"
          >
            {loading ? 'Saving…' : 'Save item'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            aria-label="Cancel adding item"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface InlineSupplierAddProps {
  name: string;

  phone: string;

  address: string;

  email: string;

  onNameChange: (v: string) => void;

  onPhoneChange: (v: string) => void;

  onAddressChange: (v: string) => void;

  onEmailChange: (v: string) => void;

  onAdd: () => void | Promise<void>;

  onCancel: () => void;

  loading?: boolean;
}

function InlineSupplierAdd({
  name,

  phone,

  address,

  email,

  onNameChange,

  onPhoneChange,

  onAddressChange,

  onEmailChange,

  onAdd,

  onCancel,

  loading,
}: InlineSupplierAddProps) {
  const canSubmit = name.trim() && phone.trim() && address.trim();

  return (
    <div
      id="new-supplier-fields"
      className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 sm:p-4"
      onKeyDown={(event) => {
        if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
          event.preventDefault();
          if (canSubmit) void Promise.resolve(onAdd());
        }
      }}
    >
      <div>
        <p className="text-sm font-semibold text-slate-800">Add a supplier</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
          Name, contact number, and address are required.
        </p>
      </div>
      <label htmlFor="new-supplier-name" className="sr-only">
        Supplier name
      </label>
      <input
        id="new-supplier-name"
        type="text"
        placeholder="Supplier name *"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        disabled={loading}
        className="h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200"
        autoFocus
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label htmlFor="new-supplier-phone" className="sr-only">
          Contact number
        </label>
        <input
          id="new-supplier-phone"
          type="tel"
          inputMode="tel"
          placeholder="Contact number *"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          disabled={loading}
          className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200"
        />

        <label htmlFor="new-supplier-email" className="sr-only">
          Email, optional
        </label>
        <input
          id="new-supplier-email"
          type="email"
          placeholder="Email (optional)"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          disabled={loading}
          className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      <label htmlFor="new-supplier-address" className="sr-only">
        Supplier address
      </label>
      <input
        id="new-supplier-address"
        type="text"
        placeholder="Address *"
        value={address}
        onChange={(e) => onAddressChange(e.target.value)}
        disabled={loading}
        className="h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200"
      />

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={() => void Promise.resolve(onAdd())}
          disabled={loading || !canSubmit}
          className="h-10 rounded-lg bg-indigo-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          {loading ? 'Saving…' : 'Save supplier'}
        </button>
      </div>
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProductCosts() {
  const canMutate = useCanMutate();

  const isOwner = getStoredUser()?.role === 'owner'; // Added Owner Check

  const {
    stats,

    filteredTransactions,

    addTransaction,

    deleteTransaction,

    updateTransaction,

    productCostItems,

    suppliers,

    addProductCostItem,

    addSupplier,

    renameProductCostItem,

    deleteProductCostItem,

    renameSupplier,

    deleteSupplier,

    setCustomDateRange,

    customDateRange,
  } = useERP();

  const supplierNames = useMemo(() => suppliers.map((s) => s.name), [suppliers]);

  const productItemNames = useMemo(() => productCostItems.map((i) => i.name), [productCostItems]);

  const [costDate, setCostDate] = useState(todayISO);

  const [newItemName, setNewItemName] = useState('');

  const [newSupplier, setNewSupplier] = useState('');

  const [newSupplierPhone, setNewSupplierPhone] = useState('');

  const [newSupplierAddress, setNewSupplierAddress] = useState('');

  const [newSupplierEmail, setNewSupplierEmail] = useState('');

  const [addingItem, setAddingItem] = useState(false);

  const [addingSupplier, setAddingSupplier] = useState(false);

  const [showAddItem, setShowAddItem] = useState(false);

  const [showAddSupplier, setShowAddSupplier] = useState(false);

  const [manageItemOpen, setManageItemOpen] = useState(false);

  const [manageSupplierOpen, setManageSupplierOpen] = useState(false);

  // Entry drawer state

  const [showEntryDrawer, setShowEntryDrawer] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);

  // Use the actual space below the ERP header, including nested layout padding.
  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!page) return;

    const fitPage = () => {
      let pageTop = page.getBoundingClientRect().top + window.scrollY;
      let ancestor = page.parentElement;
      while (ancestor && ancestor !== document.body && ancestor !== document.documentElement) {
        pageTop += ancestor.scrollTop;
        ancestor = ancestor.parentElement;
      }
      const parentPadding = page.parentElement
        ? parseFloat(window.getComputedStyle(page.parentElement).paddingBottom) || 0
        : 0;
      // Preserve the existing mobile navigation clearance.
      const mobileClearance = window.matchMedia('(max-width: 639px)').matches ? 80 : 0;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const height = Math.max(
        0,
        viewportHeight - pageTop - Math.max(12, parentPadding) - mobileClearance
      );
      page.style.setProperty('--product-page-height', `${height}px`);
    };

    fitPage();
    const observer = new ResizeObserver(fitPage);
    if (page.parentElement) observer.observe(page.parentElement);
    window.addEventListener('resize', fitPage);
    window.visualViewport?.addEventListener('resize', fitPage);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fitPage);
      window.visualViewport?.removeEventListener('resize', fitPage);
    };
  }, []);

  // Keep the page behind the drawer stationary; restore its scroll styles on close.
  useEffect(() => {
    if (!showEntryDrawer) return;

    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;
    };
  }, [showEntryDrawer]);
  const [historyView, setHistoryView] = useState<'table' | 'grid'>('table');
  const [usageView, setUsageView] = useState<'table' | 'grid'>('table');

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  const [pendingAction, setPendingAction] = useState<(() => void | Promise<void>) | null>(null);

  const [passwordModalTitle, setPasswordModalTitle] = useState('');

  const [passwordModalRole, setPasswordModalRole] = useState<'owner' | 'manager'>('owner');

  const [editModalOpen, setEditModalOpen] = useState(false);

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Table filters

  const [historySearch, setHistorySearch] = useState('');

  const [historyMethodFilter, setHistoryMethodFilter] = useState<MethodFilterValue>('all');

  const {
    register,

    handleSubmit: handleFormSubmit,

    formState: { errors, isSubmitting },

    reset,

    control,

    setValue,
  } = useForm<ProductCostFormData>({
    resolver: zodResolver(productCostSchema),

    defaultValues: {
      item: '',

      cost: '',

      method: 'cash',

      quantity: '',

      unit: 'pcs',

      unitPrice: '',

      supplier: '',
    },
  });

  // Watch quantity and total cost to auto-calculate unit price

  const quantity = useWatch({ control, name: 'quantity' });

  const cost = useWatch({ control, name: 'cost' });

  // Auto-calculate unit price from total cost ÷ qty

  useEffect(() => {
    const qty = parseFloat(quantity || '0');

    const totalCost = parseFloat(cost || '0');

    if (!isNaN(qty) && !isNaN(totalCost) && qty > 0 && totalCost > 0) {
      setValue('unitPrice', (totalCost / qty).toFixed(2), {
        shouldValidate: true,
      });
    } else {
      setValue('unitPrice', '');
    }
  }, [quantity, cost, setValue]);

  // ── Derived data ─────────────────────────────────────────────────────────

  const productExpenses = useMemo(
    () => filteredTransactions.filter((t) => t.type === 'expense_product'),

    [filteredTransactions]
  );

  const productUsageArray = useMemo(
    () =>
      Object.entries(stats.productUsage).map(([name, data]) => ({
        name,
        ...data,
      })),

    [stats.productUsage]
  );

  const topItemsBySpend = useMemo(
    () => [...productUsageArray].sort((a, b) => b.cost - a.cost).slice(0, 6),

    [productUsageArray]
  );

  const productByMethod = useMemo(() => {
    const b = { cash: 0, bank: 0, bkash: 0 };

    productExpenses.forEach((t) => {
      const method = t.method ?? 'cash';

      if (method in b) b[method as keyof typeof b] += t.amount;
    });

    return b;
  }, [productExpenses]);

  const uniqueSuppliers = useMemo(
    () => new Set(productExpenses.filter((t) => t.supplier).map((t) => t.supplier)).size,

    [productExpenses]
  );

  const hasHistoryFilters = historySearch !== '' || historyMethodFilter !== 'all';

  const filteredProductExpenses = useMemo(() => {
    return productExpenses.filter((t) => {
      if (
        historySearch &&
        !t.description.toLowerCase().includes(historySearch.toLowerCase()) &&
        !(t.supplier ?? '').toLowerCase().includes(historySearch.toLowerCase())
      )
        return false;

      if (historyMethodFilter !== 'all' && t.method !== historyMethodFilter) return false;

      return true;
    });
  }, [productExpenses, historySearch, historyMethodFilter]);

  const filteredHistoryTotal = useMemo(
    () => filteredProductExpenses.reduce((s, t) => s + t.amount, 0),

    [filteredProductExpenses]
  );

  const { paginatedData: paginatedExpenses, pagination } = useClientPagination(
    filteredProductExpenses,

    { initialPageSize: 10, pageSizeOptions: [5, 10, 20] }
  );

  const { paginatedData: paginatedUsage, pagination: usagePagination } = useClientPagination(
    productUsageArray,

    { initialPageSize: 10, pageSizeOptions: [5, 10, 20] }
  );

  const exportConfig = useMemo(
    () => ({
      filenameBase: 'product_costs',

      title: 'Purchases',

      subtitle: 'Supplier purchases and item totals',

      columns: TRANSACTION_EXPORT_COLUMNS,

      sheetName: 'Purchases',

      getData: () => filteredProductExpenses,

      summaryRows: filteredProductExpenses.length
        ? ([['TOTAL (৳)', filteredHistoryTotal]] as Array<[string, string | number]>)
        : undefined,
    }),

    [filteredProductExpenses, filteredHistoryTotal]
  );

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (data: ProductCostFormData) => {
      try {
        addTransaction({
          type: 'expense_product',

          category: 'Product',

          amount: Number(data.cost),

          method: data.method,

          description: data.item || 'Product Purchase',

          quantity: data.quantity ? Number(data.quantity) : undefined,

          unit: data.quantity ? data.unit : undefined,

          unitPrice: data.unitPrice ? Number(data.unitPrice) : undefined,

          supplier: data.supplier,

          date: parseLocalDate(costDate),
        });

        toast.success('Purchase recorded successfully.');

        reset();

        setCostDate(todayISO());

        // Auto-close form on mobile after success to show history

        setShowEntryDrawer(false);
      } catch (error) {
        handleError(error, {
          action: 'add_product_cost',

          severity: 'high',

          metadata: { item: data.item, cost: data.cost },
        });
      }
    },

    [addTransaction, reset, costDate]
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
            action: 'delete_product_cost',

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
          action: 'update_product_cost',

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
      toast.error('Enter an item name');

      return;
    }

    setAddingItem(true);

    try {
      await addProductCostItem(trimmed);

      setValue('item', trimmed);

      setNewItemName('');

      setShowAddItem(false);

      toast.success('Item added');
    } catch (error) {
      handleError(error, {
        action: 'add_item_name',

        severity: 'medium',

        metadata: { itemName: trimmed },
      });

      toast.error('Could not save item — check you are logged in as owner/manager');
    } finally {
      setAddingItem(false);
    }
  }, [newItemName, addProductCostItem, setValue]);

  const handleAddSupplier = useCallback(async () => {
    const name = newSupplier.trim();

    const phone = newSupplierPhone.trim();

    const address = newSupplierAddress.trim();

    if (!name || !phone || !address) {
      toast.error('Name, contact, and address are required');

      return;
    }

    setAddingSupplier(true);

    try {
      await addSupplier({
        name,

        phone,

        address,

        email: newSupplierEmail.trim() || undefined,
      });

      setValue('supplier', name);

      setNewSupplier('');

      setNewSupplierPhone('');

      setNewSupplierAddress('');

      setNewSupplierEmail('');

      setShowAddSupplier(false);

      toast.success('Supplier added');
    } catch (error) {
      handleError(error, {
        action: 'add_supplier',

        severity: 'medium',

        metadata: { supplier: name },
      });

      toast.error('Could not save supplier — contact and address are required');
    } finally {
      setAddingSupplier(false);
    }
  }, [newSupplier, newSupplierPhone, newSupplierAddress, newSupplierEmail, addSupplier, setValue]);

  const handleCancelAddItem = useCallback(() => {
    setShowAddItem(false);

    setNewItemName('');
  }, []);

  const handleCancelAddSupplier = useCallback(() => {
    setShowAddSupplier(false);

    setNewSupplier('');

    setNewSupplierPhone('');

    setNewSupplierAddress('');

    setNewSupplierEmail('');
  }, []);

  const handlePasswordModalClose = useCallback(() => {
    setPasswordModalOpen(false);

    setPendingAction(null);
  }, []);

  const handlePasswordModalConfirm = useCallback(() => {
    pendingAction?.();
  }, [pendingAction]);

  const handleEditModalClose = useCallback(() => {
    setEditModalOpen(false);

    setEditingTransaction(null);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      ref={pageRef}
      className={`flex min-w-0 flex-col gap-3 sm:gap-4 ${isInsightsOpen ? 'pb-20 sm:pb-0' : ''}`}
      style={{
        height: isInsightsOpen ? 'auto' : 'var(--product-page-height, calc(100dvh - 10rem))',
      }}
    >
      {/* ── Modals ── */}

      <ManagerPasswordModal
        isOpen={passwordModalOpen}
        onClose={handlePasswordModalClose}
        onConfirm={handlePasswordModalConfirm}
        title={passwordModalTitle}
        requiredRole={passwordModalRole}
      />

      <EditTransactionModal
        isOpen={editModalOpen}
        onClose={handleEditModalClose}
        transaction={editingTransaction}
        onSave={handleSaveEdit}
        itemNames={productItemNames}
        suppliers={supplierNames}
      />

      <ManageListModal
        isOpen={manageItemOpen}
        onClose={() => setManageItemOpen(false)}
        title="Manage Item Names"
        items={productItemNames}
        emptyText="No item names saved yet."
        onRename={renameProductCostItem}
        onDelete={deleteProductCostItem}
      />

      <ManageListModal
        isOpen={manageSupplierOpen}
        onClose={() => setManageSupplierOpen(false)}
        title="Manage Suppliers"
        items={supplierNames}
        emptyText="No suppliers saved yet."
        onRename={renameSupplier}
        onDelete={deleteSupplier}
      />

      {showEntryDrawer && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close purchase form"
            onClick={() => setShowEntryDrawer(false)}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-cost-drawer-title"
            className="absolute right-0 top-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
              <div>
                <h2
                  id="product-cost-drawer-title"
                  className="text-base font-bold text-slate-800 sm:text-lg"
                >
                  Record Product Purchase
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Add the item, amount paid, and purchase details.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEntryDrawer(false)}
                aria-label="Close"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X size={18} />
              </button>
            </div>
            {/* The fields scroll independently of the header and Save Purchase footer. */}
            {canMutate && (
              <form
                onSubmit={handleFormSubmit(handleSubmit)}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 [scrollbar-width:thin] sm:px-6 sm:py-5">
                  <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">Purchase item</h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        Choose a saved item and supplier, or add them here.
                      </p>
                    </div>

                    {/* Item picker */}

                    <div>
                      <div className="flex justify-between items-center gap-3 mb-2">
                        <label
                          htmlFor="item"
                          className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide"
                        >
                          Item
                        </label>

                        <div className="flex items-center gap-1.5">
                          {/* Only Owner can edit/delete stored descriptions */}

                          {isOwner && (
                            <button
                              type="button"
                              onClick={() => setManageItemOpen(true)}
                              className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                              title="Manage item names"
                            >
                              <Pencil size={14} aria-hidden="true" /> Manage
                            </button>
                          )}

                          {!showAddItem && (
                            <button
                              type="button"
                              onClick={() => setShowAddItem(true)}
                              aria-label="Add a saved product item"
                              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-800 transition-colors hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                            >
                              <Plus size={13} aria-hidden="true" /> New item
                            </button>
                          )}
                        </div>
                      </div>

                      {showAddItem ? (
                        <InlineAddField
                          value={newItemName}
                          onChange={setNewItemName}
                          onAdd={handleAddItemName}
                          onCancel={handleCancelAddItem}
                          placeholder="New item name..."
                          loading={addingItem}
                        />
                      ) : (
                        <>
                          <SelectWithChevron
                            id="item"
                            {...register('item')}
                            hasError={!!errors.item}
                            className="bg-slate-50"
                          >
                            <option value="">Choose an item...</option>

                            {productCostItems.map((item) => (
                              <option key={item.id} value={item.name}>
                                {item.name}
                              </option>
                            ))}
                          </SelectWithChevron>

                          {productCostItems.length === 0 && (
                            <p className="text-[11px] text-slate-500 mt-2">
                              No saved items yet. Use “New item” to add one.
                            </p>
                          )}

                          <FieldError message={errors.item?.message} />
                        </>
                      )}
                    </div>

                    {/* Supplier picker */}

                    <div>
                      <div className="flex justify-between items-center gap-3 mb-2">
                        <label
                          htmlFor="supplier"
                          className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5"
                        >
                          <Users size={12} /> Supplier
                        </label>

                        <div className="flex items-center gap-1.5">
                          {/* Only Owner can edit/delete stored suppliers */}

                          {isOwner && (
                            <button
                              type="button"
                              onClick={() => setManageSupplierOpen(true)}
                              className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                              title="Manage suppliers"
                            >
                              <Pencil size={14} aria-hidden="true" /> Manage
                            </button>
                          )}

                          {!showAddSupplier && (
                            <button
                              type="button"
                              onClick={() => setShowAddSupplier(true)}
                              aria-label="Add a supplier to the saved list"
                              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-800 transition-colors hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                            >
                              <Plus size={13} aria-hidden="true" /> New supplier
                            </button>
                          )}
                        </div>
                      </div>

                      {showAddSupplier ? (
                        <InlineSupplierAdd
                          name={newSupplier}
                          phone={newSupplierPhone}
                          address={newSupplierAddress}
                          email={newSupplierEmail}
                          onNameChange={setNewSupplier}
                          onPhoneChange={setNewSupplierPhone}
                          onAddressChange={setNewSupplierAddress}
                          onEmailChange={setNewSupplierEmail}
                          onAdd={handleAddSupplier}
                          onCancel={handleCancelAddSupplier}
                          loading={addingSupplier}
                        />
                      ) : (
                        <>
                          <SelectWithChevron
                            id="supplier"
                            {...register('supplier')}
                            hasError={!!errors.supplier}
                            className="bg-slate-50"
                          >
                            <option value="">Choose a supplier...</option>

                            {suppliers.map((sup) => (
                              <option key={sup.id} value={sup.name}>
                                {sup.name}
                              </option>
                            ))}
                          </SelectWithChevron>

                          {suppliers.length === 0 && (
                            <p className="text-[11px] text-slate-500 mt-2">
                              No saved suppliers yet. Use “New supplier” to add one.
                            </p>
                          )}

                          <FieldError message={errors.supplier?.message} />
                        </>
                      )}
                    </div>
                  </section>

                  {/* Cost and quantity details */}

                  <div className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-100 space-y-4">
                    {/* Purchase amount and unit cost */}

                    <div>
                      <label
                        htmlFor="cost"
                        className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block"
                      >
                        Total Amount Paid (৳)
                      </label>

                      <input
                        id="cost"
                        step="any"
                        placeholder="0.00"
                        {...register('cost')}
                        className={`w-full h-11 px-3 sm:px-4 bg-white border ${
                          errors.cost ? 'border-red-400' : 'border-indigo-300'
                        } rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 text-sm`}
                      />

                      <p className="text-[10px] sm:text-[11px] text-slate-500 mt-2 leading-relaxed">
                        Type the total amount on the receipt. Unit price calculates automatically.
                      </p>

                      <FieldError message={errors.cost?.message} />
                    </div>

                    {/* Qty / Unit / Unit Price */}

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="col-span-1 sm:col-span-1">
                        <label
                          htmlFor="quantity"
                          className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block"
                        >
                          Quantity
                        </label>

                        <input
                          id="quantity"
                          step="any"
                          placeholder="0.00"
                          {...register('quantity')}
                          className={`w-full h-11 px-3 sm:px-4 bg-white border ${
                            errors.quantity ? 'border-red-400' : 'border-slate-200'
                          } rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm`}
                        />

                        <FieldError message={errors.quantity?.message} />
                      </div>

                      <div className="col-span-1 sm:col-span-1">
                        <label
                          htmlFor="unit"
                          className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block"
                        >
                          Unit
                        </label>

                        <SelectWithChevron id="unit" {...register('unit')} className="bg-white">
                          {UNIT_OPTIONS.map(({ value, label }) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </SelectWithChevron>
                      </div>

                      <div className="col-span-2 sm:col-span-1">
                        <label
                          htmlFor="unitPrice"
                          className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wide mb-2 block"
                        >
                          Unit cost (calculated)
                        </label>

                        <input
                          id="unitPrice"
                          type="number"
                          step="any"
                          placeholder="0.00"
                          readOnly
                          {...register('unitPrice')}
                          className={`w-full h-11 px-3 sm:px-4 bg-emerald-50/50 border ${
                            errors.unitPrice ? 'border-red-400' : 'border-emerald-200'
                          } rounded-xl outline-none text-emerald-700 font-bold text-sm cursor-not-allowed`}
                        />

                        <FieldError message={errors.unitPrice?.message} />
                      </div>
                    </div>
                  </div>

                  {/* Payment method and purchase date */}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="method"
                        className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block"
                      >
                        Payment method
                      </label>

                      <SelectWithChevron
                        id="method"
                        {...register('method')}
                        className="bg-slate-50"
                      >
                        {PAYMENT_METHODS.map(({ value, label }) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </SelectWithChevron>
                    </div>

                    <div>
                      <label
                        htmlFor="cost-date"
                        className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block"
                      >
                        Purchase Date
                      </label>

                      <input
                        id="cost-date"
                        type="date"
                        value={costDate}
                        max={todayISO()}
                        onChange={(e) => setCostDate(e.target.value)}
                        className="w-full h-11 px-2.5 sm:px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div className="shrink-0 border-t border-slate-200 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
                  <ButtonLoading
                    loading={isSubmitting}
                    type="submit"
                    className="flex min-h-12 w-full items-center justify-center whitespace-nowrap rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Save Purchase
                  </ButtonLoading>
                </div>
              </form>
            )}
          </aside>
        </div>
      )}

      {/* ── Right Panel ──────────────────────────────────────────────────── */}

      <div
        className={`flex min-w-0 flex-col gap-3 sm:gap-4 ${isInsightsOpen ? '' : 'min-h-0 flex-1'}`}
      >
        {/* ── Purchase History ─────────────────────────────────────────── */}

        <div
          className={`flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden ${isInsightsOpen ? '' : 'min-h-0 flex-1'}`}
        >
          <div
            className={
              isInsightsOpen
                ? ''
                : 'min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]'
            }
          >
            {/* Table header */}

            <div className="px-4 md:px-6 py-4 bg-slate-50/60 border-b border-slate-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-bold text-slate-700 text-sm">Purchase History</h3>

                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                    Product purchases for the selected period
                  </p>
                </div>

                {canMutate && (
                  <button
                    type="button"
                    onClick={() => setShowEntryDrawer(true)}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
                  >
                    <Plus size={16} aria-hidden="true" /> Record Purchase
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
                      placeholder="Search item or supplier…"
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="w-full pl-9 pr-9 py-2.5 sm:py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 transition-colors"
                    />

                    {historySearch && (
                      <button
                        type="button"
                        onClick={() => setHistorySearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200"
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

                    {hasHistoryFilters && (
                      <button
                        type="button"
                        onClick={() => {
                          setHistorySearch('');

                          setHistoryMethodFilter('all');
                        }}
                        className="text-[11px] sm:text-xs font-semibold text-slate-500 hover:text-slate-700 underline underline-offset-2 transition-colors"
                      >
                        Clear filters
                      </button>
                    )}

                    <div className="shrink-0">
                      <ExportDropdown
                        config={exportConfig}
                        disabled={filteredProductExpenses.length === 0}
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
                        onClick={() => setHistoryMethodFilter(val)}
                        className={`px-3 sm:px-2.5 py-1.5 sm:py-1 text-[11px] font-bold rounded-md transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
                          historyMethodFilter === val
                            ? 'bg-slate-800 text-white shadow-sm'
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
                  <div
                    className="flex shrink-0 items-center gap-1.5"
                    role="group"
                    aria-label="Purchase history view"
                  >
                    <span className="sr-only">View</span>
                    <button
                      type="button"
                      onClick={() => setHistoryView('table')}
                      aria-pressed={historyView === 'table'}
                      className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${historyView === 'table' ? 'border-orange-200 bg-orange-50 text-orange-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      <List size={14} aria-hidden="true" />
                      Table
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryView('grid')}
                      aria-pressed={historyView === 'grid'}
                      className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${historyView === 'grid' ? 'border-orange-200 bg-orange-50 text-orange-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      <LayoutGrid size={14} aria-hidden="true" />
                      Grid
                    </button>
                  </div>
                </div>
              </div>

              {hasHistoryFilters && (
                <p className="text-[11px] text-slate-500 mt-3 pt-3 border-t border-slate-200/60">
                  Showing{' '}
                  <span className="font-bold text-slate-700 tabular-nums">
                    {filteredProductExpenses.length}
                  </span>{' '}
                  of{' '}
                  <span className="font-bold text-slate-700 tabular-nums">
                    {productExpenses.length}
                  </span>{' '}
                  records
                </p>
              )}
            </div>

            {historyView === 'table' ? (
              <>
                {/* Responsive purchase history */}
                <div className="divide-y divide-slate-100 md:hidden">
                  {paginatedExpenses.length > 0 ? (
                    paginatedExpenses.map((t) => (
                      <article key={t.id} className="space-y-2.5 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">
                              {t.description}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {formatDate(t.date)}
                              {t.supplier ? ` · ${t.supplier}` : ''}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-extrabold tabular-nums text-orange-700">
                            -{formatCurrency(t.amount)}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="text-xs font-semibold text-slate-600">
                              {t.quantity ? `${t.quantity} ${t.unit ?? ''}` : 'Qty —'}
                            </span>
                            <MethodBadge method={t.method ?? 'cash'} />
                          </div>
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
                      No purchase records for the selected period.
                    </div>
                  )}
                </div>
                <div className="hidden overflow-hidden md:block">
                  <table className="w-full table-fixed text-left">
                    <thead className="bg-slate-50 border-b-2 border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 sm:px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-[13%]">
                          Date
                        </th>

                        <th className="px-4 sm:px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-[22%]">
                          Item
                        </th>

                        <th className="px-4 sm:px-5 py-3.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider w-[11%]">
                          Qty
                        </th>

                        <th className="px-4 sm:px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-[16%]">
                          Supplier
                        </th>

                        <th className="px-4 sm:px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-[13%]">
                          Via
                        </th>

                        <th className="px-4 sm:px-5 py-3.5 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider w-[13%]">
                          Cost
                        </th>

                        {/* Actions Header only renders for Owners */}

                        {isOwner && (
                          <th className="px-4 sm:px-5 py-3.5 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider w-[12%]">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {paginatedExpenses.length > 0 ? (
                        paginatedExpenses.map((t) => (
                          <tr key={t.id} className="hover:bg-orange-50/40 transition-colors group">
                            <td className="px-4 sm:px-5 py-3 sm:py-3.5 text-xs font-medium text-slate-600 whitespace-nowrap tabular-nums">
                              {formatDate(t.date)}
                            </td>

                            <td className="px-4 sm:px-5 py-3 sm:py-3.5 max-w-[180px]">
                              <span className="text-xs sm:text-sm font-semibold text-slate-700 block truncate">
                                {t.description}
                              </span>
                            </td>

                            <td className="px-4 sm:px-5 py-3 sm:py-3.5 text-center">
                              {t.quantity ? (
                                <span className="text-xs font-bold text-slate-700 whitespace-nowrap tabular-nums">
                                  {t.quantity}{' '}
                                  <span className="text-[10px] text-slate-400 font-normal uppercase">
                                    {t.unit}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>

                            <td className="px-4 sm:px-5 py-3 sm:py-3.5">
                              {t.supplier ? (
                                <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-md px-2 py-0.5 text-[11px] font-medium text-slate-600 whitespace-nowrap">
                                  {t.supplier}
                                </span>
                              ) : (
                                <span className="text-slate-300 text-sm">—</span>
                              )}
                            </td>

                            <td className="px-4 sm:px-5 py-3 sm:py-3.5">
                              <MethodBadge method={t.method ?? 'cash'} />
                            </td>

                            <td className="px-4 sm:px-5 py-3 sm:py-3.5 text-right">
                              <span className="text-sm font-extrabold text-orange-600 tabular-nums whitespace-nowrap">
                                -{formatCurrency(t.amount)}
                              </span>
                            </td>

                            {/* Edit/Delete Actions only render for Owners */}

                            {isOwner && (
                              <td className="px-4 sm:px-5 py-3 sm:py-3.5 text-right">
                                <div className="flex gap-1.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity justify-end">
                                  <button
                                    onClick={() => handleManagerEdit(t)}
                                    className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-slate-50 px-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700 lg:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                                    title="Edit (Owner Only)"
                                    aria-label={`Edit transaction: ${t.description}`}
                                  >
                                    <Pencil size={14} aria-hidden="true" /> Edit
                                  </button>

                                  <button
                                    onClick={() => handleManagerDelete(t.id)}
                                    className="p-2 sm:p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 bg-slate-50 lg:bg-transparent rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                                    title="Delete (Owner Only)"
                                    aria-label={`Delete transaction: ${t.description}`}
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
                          {/* Shift colSpan dynamically based on role */}

                          <td colSpan={isOwner ? 7 : 6} className="px-4 py-8 sm:py-10 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <Package size={28} className="text-slate-300" />
                              </div>

                              <div>
                                <p className="text-sm font-semibold text-slate-600">
                                  No records found
                                </p>

                                <p className="text-xs text-slate-400 mt-1 max-w-[200px] mx-auto leading-relaxed">
                                  {hasHistoryFilters
                                    ? 'Try adjusting your filters'
                                    : 'No purchases for the selected period'}
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
              <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">
                {paginatedExpenses.length > 0 ? (
                  paginatedExpenses.map((t) => (
                    <article
                      key={t.id}
                      className="flex min-w-0 flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-orange-200 hover:bg-orange-50/20"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {t.description}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDate(t.date)}
                            {t.supplier ? ` · ${t.supplier}` : ''}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-bold tabular-nums text-orange-700">
                          -{formatCurrency(t.amount)}
                        </span>
                      </div>
                      <div className="flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
                        <div className="min-w-0 space-y-1.5">
                          <p className="text-xs text-slate-600">
                            Quantity{' '}
                            <span className="font-semibold">
                              {t.quantity ? `${t.quantity} ${t.unit ?? ''}` : '—'}
                            </span>
                          </p>
                          <MethodBadge method={t.method ?? 'cash'} />
                        </div>
                        {isOwner && (
                          <div className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              onClick={() => handleManagerEdit(t)}
                              aria-label={`Edit transaction: ${t.description}`}
                              className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                            >
                              <Pencil size={14} aria-hidden="true" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleManagerDelete(t.id)}
                              aria-label={`Delete transaction: ${t.description}`}
                              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
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
                    No purchase records for the selected period.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer stays accessible while purchase history scrolls. */}

          {filteredProductExpenses.length > 0 && (
            <div className="shrink-0 px-4 sm:px-5 py-3 border-t border-slate-200 bg-slate-50 flex flex-col md:flex-row items-center justify-between gap-2">
              <p className="text-xs text-slate-500 w-full text-center md:text-left">
                <span className="font-bold text-slate-700 tabular-nums">
                  {filteredProductExpenses.length}
                </span>{' '}
                record{filteredProductExpenses.length !== 1 ? 's' : ''} ·{' '}
                <span className="font-bold text-orange-600 whitespace-nowrap tabular-nums">
                  {formatCurrency(filteredHistoryTotal)}
                </span>{' '}
                total
              </p>

              <div className="w-full md:w-auto">
                <Pagination pagination={pagination} showPageInfo={false} />
              </div>
            </div>
          )}
        </div>

        <details
          open={isInsightsOpen}
          onToggle={(event) => setIsInsightsOpen(event.currentTarget.open)}
          className="group shrink-0 rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3.5 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 sm:px-5">
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-800">
                Insights and item breakdown
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Spending patterns, payment mix, and average item cost
              </span>
            </span>
            <ChevronDown
              size={17}
              className="shrink-0 text-slate-500 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>

          <div className="space-y-4 border-t border-slate-200 p-3 sm:p-4">
            {/* ── Summary Card ─────────────────────────────────────────────── */}

            <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
              {/* Header */}

              <div className="p-4 md:p-6 bg-gradient-to-r from-orange-50 via-white to-slate-50 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 sm:mb-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 sm:p-2.5 bg-orange-100 rounded-lg sm:rounded-xl text-orange-600 shadow-sm shrink-0">
                      <Package size={20} className="sm:w-5 sm:h-5" />
                    </div>

                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">
                        Purchase Insights
                      </h3>

                      <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                        Ingredient &amp; packaging spend overview
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 bg-orange-600 text-white px-4 py-2.5 sm:py-3 rounded-xl shadow-sm sm:shadow-md sm:shadow-orange-200 w-full sm:w-auto text-center sm:text-right">
                    <p className="text-[10px] sm:text-xs font-bold text-orange-200 uppercase tracking-widest leading-none mb-1">
                      Total
                    </p>

                    <p className="text-xl sm:text-2xl font-extrabold tabular-nums">
                      {formatCurrency(stats.totalProductCost)}
                    </p>
                  </div>
                </div>

                {/* Mini stats */}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  <MiniStat
                    label="Purchases"
                    value={productExpenses.length.toString()}
                    icon={TrendingDown}
                    iconColor="text-orange-600"
                    iconBg="bg-orange-100"
                  />

                  <MiniStat
                    label="Unique Items"
                    value={productUsageArray.length.toString()}
                    icon={Hash}
                    iconColor="text-indigo-600"
                    iconBg="bg-indigo-100"
                  />

                  <div className="col-span-2 sm:col-span-1">
                    <MiniStat
                      label="Suppliers"
                      value={uniqueSuppliers.toString()}
                      icon={Users}
                      iconColor="text-sky-600"
                      iconBg="bg-sky-100"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 md:p-6 space-y-5">
                {/* Top items by spend */}

                {topItemsBySpend.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                      Top Items by Spend
                    </h4>

                    <div className="space-y-3">
                      {topItemsBySpend.map((item) => {
                        const pct =
                          topItemsBySpend[0]?.cost > 0
                            ? Math.round((item.cost / topItemsBySpend[0].cost) * 100)
                            : 0;

                        const sharePct =
                          stats.totalProductCost > 0
                            ? Math.round((item.cost / stats.totalProductCost) * 100)
                            : 0;

                        return (
                          <div key={item.name}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />

                                <span className="text-xs sm:text-sm font-semibold text-slate-700 truncate">
                                  {item.name}
                                </span>

                                <span className="text-[9px] sm:text-[10px] text-slate-400 shrink-0 hidden sm:inline-block tabular-nums">
                                  {item.qty} {item.unit}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                                <span className="text-xs sm:text-sm font-extrabold text-orange-700 tabular-nums">
                                  {formatCurrency(item.cost)}
                                </span>

                                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 w-6 sm:w-7 text-right tabular-nums">
                                  {sharePct}%
                                </span>
                              </div>
                            </div>

                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Payment method split */}

                {productExpenses.length > 0 && (
                  <>
                    {topItemsBySpend.length > 0 && <div className="border-t border-slate-100" />}

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
                          const amount = productByMethod[key as keyof typeof productByMethod];

                          const pct =
                            stats.totalProductCost > 0
                              ? Math.round((amount / stats.totalProductCost) * 100)
                              : 0;

                          const Icon = cfg.icon;

                          return (
                            <div
                              key={key}
                              className={`p-3.5 sm:p-4 rounded-xl border ${cfg.border} ${cfg.bg} flex flex-col gap-2`}
                            >
                              <div className="flex items-center justify-between sm:justify-start gap-2">
                                <div className="flex items-center gap-2">
                                  <Icon size={14} className={cfg.color} />

                                  <span className={`text-xs font-bold ${cfg.color}`}>
                                    {cfg.label}
                                  </span>
                                </div>

                                <span className="sm:hidden text-sm font-extrabold text-slate-800 tabular-nums">
                                  {formatCurrency(amount)}
                                </span>
                              </div>

                              <p className="hidden sm:block text-base font-extrabold text-slate-800 tabular-nums mt-1">
                                {formatCurrency(amount)}
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

                                <span className="text-[10px] font-bold text-slate-500 w-6 text-right tabular-nums">
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

                {/* Empty fallback */}

                {productUsageArray.length === 0 && (
                  <div className="py-8 text-center text-slate-400 text-sm">
                    No product usage recorded for this period.
                  </div>
                )}
              </div>
            </div>

            {/* Product usage breakdown table/grid */}
            {productUsageArray.length > 0 && (
              <section className="overflow-hidden rounded-xl border border-slate-200">
                <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-600">
                      Full Item Breakdown
                    </h4>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Compare purchased quantity, total spend, and average unit cost.
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setUsageView('table')}
                      aria-pressed={usageView === 'table'}
                      className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${usageView === 'table' ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      <List size={14} />
                      Table
                    </button>
                    <button
                      type="button"
                      onClick={() => setUsageView('grid')}
                      aria-pressed={usageView === 'grid'}
                      className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${usageView === 'grid' ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      <LayoutGrid size={14} />
                      Grid
                    </button>
                  </div>
                </div>

                {usageView === 'table' ? (
                  <>
                    <div className="divide-y divide-slate-100 md:hidden">
                      {paginatedUsage.map((item) => (
                        <article
                          key={item.name}
                          className="flex items-start justify-between gap-3 p-4"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">
                              {item.name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Qty {item.qty} {item.unit}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Average {formatCurrency(item.cost / (item.qty || 1))} / {item.unit}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-extrabold tabular-nums text-orange-700">
                            {formatCurrency(item.cost)}
                          </p>
                        </article>
                      ))}
                    </div>
                    <div className="hidden overflow-hidden md:block">
                      <table className="w-full table-fixed text-left">
                        <thead className="border-b border-slate-200 bg-slate-50">
                          <tr>
                            <th className="w-[40%] px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                              Item Name
                            </th>
                            <th className="w-[20%] px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">
                              Total Qty
                            </th>
                            <th className="w-[20%] px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">
                              Total Cost
                            </th>
                            <th className="w-[20%] px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">
                              Avg Price
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {paginatedUsage.map((item) => (
                            <tr key={item.name} className="hover:bg-orange-50/30">
                              <td className="truncate px-4 py-3 text-sm font-semibold text-slate-700">
                                {item.name}
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-slate-700">
                                {item.qty}{' '}
                                <span className="text-xs font-normal uppercase text-slate-400">
                                  {item.unit}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-extrabold tabular-nums text-orange-700">
                                {formatCurrency(item.cost)}
                              </td>
                              <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-600">
                                {formatCurrency(item.cost / (item.qty || 1))} / {item.unit}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                    {paginatedUsage.map((item) => (
                      <article
                        key={item.name}
                        className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-orange-200 hover:bg-orange-50/20"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 truncate text-sm font-semibold text-slate-800">
                            {item.name}
                          </p>
                          <span className="shrink-0 text-sm font-extrabold tabular-nums text-orange-700">
                            {formatCurrency(item.cost)}
                          </span>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              Quantity
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-700">
                              {item.qty} {item.unit}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              Avg. price
                            </p>
                            <p className="mt-1 truncate text-sm font-semibold text-slate-700">
                              {formatCurrency(item.cost / (item.qty || 1))} / {item.unit}
                            </p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                <div className="flex justify-center border-t border-slate-200 bg-slate-50 px-4 py-3 sm:justify-start">
                  <Pagination pagination={usagePagination} showPageInfo={false} />
                </div>
              </section>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}
