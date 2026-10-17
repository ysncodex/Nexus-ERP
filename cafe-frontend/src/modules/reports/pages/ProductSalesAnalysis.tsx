/**
 * Product Sales Analysis — monthly (or custom-range) breakdown of individual
 * product performance: quantity sold, revenue, average price, and revenue
 * share, with an optional order-type / category filter.
 *
 * Backend-driven: calls GET /api/reports/product-sales so the client never
 * needs to hold the entire sales ledger for this view.
 *
 * Layout: the root fills its parent (`h-full`). Header and filters stay fixed,
 * the body scrolls, and the product table takes the remaining height and
 * scrolls internally on desktop. The parent should be a flex child with
 * `min-h-0` / a definite height; otherwise the page simply scrolls normally.
 */
import { useState, useMemo, useCallback, useEffect, useRef, type ReactNode } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ArrowRight,
  Search,
  X,
  Calendar,
  CalendarRange,
  Package,
  Boxes,
  Wallet,
  Trophy,
  BarChart3,
  UtensilsCrossed,
  ShoppingBag,
  Bike,
  LayoutGrid,
  Gift,
  PieChart,
  Tag,
  Layers,
  AlertCircle,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { reportsService } from '@/core/api/services';
import type { ProductSalesReport, ProductSalesRow } from '@/core/api/services';
import {
  ALL_CATEGORIES,
  CATEGORY_STYLES,
  type MenuCategory,
} from '@/modules/sales/types/menuItem.types';
import { Pagination } from '@/shared/components/ui';
import { useClientPagination } from '@/shared/hooks';
import { handleError, formatCurrency, todayBusinessKey } from '@/shared/utils';
import { ExportDropdown } from '@/shared/export';
import type { ColDef } from '@/shared/export';

// ─── Types & config ───────────────────────────────────────────────────────────

type FilterMode = 'month' | 'range';
type OrderTypeFilter = 'All' | 'in_store' | 'takeaway' | 'delivery' | 'gift';
type CategoryFilter = MenuCategory | 'All';
type SortDir = 'asc' | 'desc';

type SortKey =
  | 'name'
  | 'category'
  | 'qtySold'
  | 'revenue'
  | 'avgSellingPrice'
  | 'percentOfTotalRevenue'
  | 'qtyGifted';

/** One label per column, reused by the table header, mobile sort and export. */
const COLUMN_LABELS: Record<SortKey, string> = {
  name: 'Product',
  category: 'Category',
  qtySold: 'Qty sold',
  revenue: 'Revenue',
  avgSellingPrice: 'Avg. price',
  percentOfTotalRevenue: 'Share',
  qtyGifted: 'Qty gifted',
};

const SALES_SORT_KEYS: SortKey[] = [
  'name',
  'category',
  'qtySold',
  'revenue',
  'avgSellingPrice',
  'percentOfTotalRevenue',
];
const GIFT_SORT_KEYS: SortKey[] = ['name', 'category', 'qtyGifted', 'qtySold'];

/** Text columns read best A→Z first; numeric columns biggest first. */
const DEFAULT_SORT_DIR: Record<SortKey, SortDir> = {
  name: 'asc',
  category: 'asc',
  qtySold: 'desc',
  revenue: 'desc',
  avgSellingPrice: 'desc',
  percentOfTotalRevenue: 'desc',
  qtyGifted: 'desc',
};

const ORDER_TYPE_PILLS: { value: OrderTypeFilter; label: string; Icon: LucideIcon }[] = [
  { value: 'All', label: 'All types', Icon: LayoutGrid },
  { value: 'in_store', label: 'Dine in', Icon: UtensilsCrossed },
  { value: 'takeaway', label: 'Takeaway', Icon: ShoppingBag },
  { value: 'delivery', label: 'Delivery', Icon: Bike },
  { value: 'gift', label: 'Gift', Icon: Gift },
];

interface SelectedMonth {
  year: number;
  month: number;
}

const rowKey = (p: ProductSalesRow) => `${p.menuItemId ?? p.name}::${p.category}`;

const formatDateKey = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

function categoryBadge(category: string) {
  const style = CATEGORY_STYLES[category as MenuCategory];
  if (!style) return { badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' };
  return style;
}

// ─── Small components ─────────────────────────────────────────────────────────

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
    <div className="flex w-full items-center justify-between gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm sm:w-auto sm:justify-center">
      <button
        type="button"
        onClick={onPrev}
        aria-label="Previous month"
        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 sm:p-1.5"
      >
        <ChevronLeft size={16} />
      </button>
      <span
        aria-live="polite"
        className="min-w-[130px] select-none px-2 text-center text-sm font-bold text-slate-700"
      >
        {label}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={disableNext}
        aria-label="Next month"
        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 sm:p-1.5"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function SortHeader({
  sortKey,
  activeKey,
  dir,
  onSort,
  align = 'left',
}: {
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const isActive = sortKey === activeKey;
  // Arrows = sorting. Chevrons are reserved for navigation / expand-collapse.
  const Icon = isActive ? (dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th
      scope="col"
      aria-sort={isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`select-none bg-slate-50 px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:px-5 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
          align === 'right' ? 'flex-row-reverse' : ''
        } ${isActive ? 'text-indigo-700' : ''}`}
      >
        {COLUMN_LABELS[sortKey]}
        <Icon size={12} className={isActive ? 'text-indigo-500' : 'text-slate-300'} />
      </button>
    </th>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor,
  iconBg,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3.5">
      <div className={`shrink-0 rounded-xl p-2.5 ${iconBg}`}>
        <Icon size={18} strokeWidth={2.5} className={iconColor} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1.5 text-[10px] font-bold uppercase leading-snug tracking-widest text-slate-400">
          {label}
        </p>
        <p
          className="break-words text-lg font-extrabold leading-snug tracking-tight text-slate-800 tabular-nums sm:text-xl"
          title={value}
        >
          {value}
        </p>
        {sub && <p className="mt-1.5 break-words text-[11px] text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

/** Both insight panels share this so title, rank, bar height and colour match. */
function RankedBars({
  title,
  rows,
  valueClass,
  className = '',
}: {
  title: string;
  rows: { key: string; name: string; display: string; ratio: number }[];
  valueClass: string;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-slate-100 bg-slate-50/80 p-4 sm:p-5 ${className}`}>
      <h4 className="mb-4 text-sm font-semibold text-slate-800">{title}</h4>
      <ol className="space-y-3">
        {rows.map((row, index) => (
          <li key={row.key} className="space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                <span className="w-5 shrink-0 text-[11px] font-black text-slate-400 tabular-nums">
                  #{index + 1}
                </span>
                <span className="break-words text-sm font-medium text-slate-700">{row.name}</span>
              </div>
              <span className={`shrink-0 text-sm font-semibold tabular-nums ${valueClass}`}>
                {row.display}
              </span>
            </div>
            <div
              aria-hidden="true"
              className="h-2 overflow-hidden rounded-full border border-slate-100 bg-white"
            >
              <div
                className="h-full rounded-full bg-indigo-500"
                style={{ width: `${Math.max(0, Math.min(100, row.ratio * 100))}%` }}
              />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

interface MixRow {
  category: string;
  display: string;
  share: number;
  count: number;
}

/** Where the money (or gifts) come from. Selecting a row filters the table by that category. */
function CategoryMix({
  title,
  rows,
  activeSearch,
  onSelect,
  barClass,
  className = '',
}: {
  title: string;
  rows: MixRow[];
  activeSearch: string;
  onSelect: (category: string) => void;
  barClass: string;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-slate-100 bg-slate-50/80 p-4 sm:p-5 ${className}`}>
      <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
      <p className="mb-3 mt-0.5 text-xs text-slate-500">Select a category to filter the table.</p>
      <ul className="space-y-1.5">
        {rows.map((row) => {
          const style = categoryBadge(row.category);
          const active = activeSearch === row.category.toLowerCase();
          return (
            <li key={row.category}>
              <button
                type="button"
                onClick={() => onSelect(row.category)}
                aria-pressed={active}
                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
                  active
                    ? 'border-indigo-300 bg-white'
                    : 'border-transparent hover:border-slate-200 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-700">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                    <span className="truncate">{row.category}</span>
                    <span className="shrink-0 text-[11px] font-normal text-slate-400">
                      {row.count} item{row.count !== 1 ? 's' : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-slate-700 tabular-nums">
                    {row.display}
                    <span className="ml-1.5 text-xs font-medium text-slate-400">
                      {row.share.toFixed(1)}%
                    </span>
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full border border-slate-100 bg-white"
                >
                  <div
                    className={`h-full rounded-full ${barClass}`}
                    style={{ width: `${Math.max(0, Math.min(100, row.share))}%` }}
                  />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Short, plain-language takeaways so the numbers don't need decoding. */
function InsightFacts({
  title,
  facts,
  className = '',
}: {
  title: string;
  facts: { icon: LucideIcon; label: string; value: string; sub: string }[];
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-slate-100 bg-slate-50/80 p-4 sm:p-5 ${className}`}>
      <h4 className="mb-4 text-sm font-semibold text-slate-800">{title}</h4>
      <dl className="space-y-4">
        {facts.map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="flex items-start gap-3">
            <div className="shrink-0 rounded-lg bg-white p-2 text-slate-500 ring-1 ring-slate-100">
              <Icon size={15} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className="break-words text-sm font-bold text-slate-800 tabular-nums">{value}</dd>
              <dd className="text-xs text-slate-500">{sub}</dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Native select with the chevron pinned in a fixed spot on the right. */
function SelectField({
  id,
  value,
  onChange,
  ariaLabel,
  children,
  className = '',
  selectClassName = '',
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
  selectClassName?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        id={id}
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200 ${selectClassName}`}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
    </div>
  );
}

function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} aria-hidden="true">
          <td colSpan={7} className="px-5 py-3.5">
            <div className="h-5 animate-pulse rounded-md bg-slate-100" />
          </td>
        </tr>
      ))}
    </>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ProductSalesAnalysis() {
  const now = new Date();
  const todayKey = todayBusinessKey();

  const [filterMode, setFilterMode] = useState<FilterMode>('month');
  const [selectedMonth, setSelectedMonth] = useState<SelectedMonth>({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [customStart, setCustomStart] = useState(todayKey);
  const [customEnd, setCustomEnd] = useState(todayKey);
  const [category, setCategory] = useState<CategoryFilter>('All');
  const [orderType, setOrderType] = useState<OrderTypeFilter>('All');
  const [search, setSearch] = useState('');
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [report, setReport] = useState<ProductSalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  // Ignore responses from superseded requests (fast month / filter switching).
  const requestId = useRef(0);

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

  const handleStartChange = (value: string) => {
    setCustomStart(value);
    if (value && customEnd && value > customEnd) setCustomEnd(value);
  };

  const rangeInvalid =
    filterMode === 'range' && (!customStart || !customEnd || customStart > customEnd);

  const periodLabel = useMemo(() => {
    if (filterMode === 'month') return monthLabel;
    if (!customStart || !customEnd) return 'Custom range';
    if (customStart === customEnd) return formatDateKey(customStart);
    return `${formatDateKey(customStart)} – ${formatDateKey(customEnd)}`;
  }, [filterMode, monthLabel, customStart, customEnd]);

  // Gift is a client-side view of the same report, so it needs no channel filter.
  const posChannel = orderType === 'All' || orderType === 'gift' ? undefined : orderType;

  const loadReport = useCallback(async () => {
    if (rangeInvalid) {
      requestId.current += 1;
      setReport(null);
      setLoadFailed(false);
      setLoading(false);
      return;
    }

    const id = ++requestId.current;
    setLoading(true);
    setLoadFailed(false);
    try {
      const query =
        filterMode === 'month'
          ? { month: `${selectedMonth.year}-${String(selectedMonth.month + 1).padStart(2, '0')}` }
          : { startDate: customStart, endDate: customEnd };
      const data = await reportsService.getProductSalesReport({
        ...query,
        category: category !== 'All' ? category : undefined,
        posChannel,
      });
      if (id !== requestId.current) return;
      setReport(data);
    } catch (error) {
      if (id !== requestId.current) return;
      setReport(null);
      setLoadFailed(true);
      handleError(error, { action: 'load_product_sales_report', severity: 'medium' });
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [filterMode, selectedMonth, customStart, customEnd, category, posChannel, rangeInvalid]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const isGiftView = orderType === 'gift';
  const products = useMemo(() => {
    const rows = report?.products ?? [];
    return isGiftView ? rows.filter((p) => p.qtyGifted > 0) : rows;
  }, [report, isGiftView]);
  const summary = report?.summary;
  const best = summary?.bestSellingProduct;

  const isBestSeller = useCallback(
    (p: ProductSalesRow) => {
      if (!best) return false;
      const bestId = (best as { menuItemId?: string | number | null }).menuItemId;
      return bestId != null && p.menuItemId != null
        ? bestId === p.menuItemId
        : best.name === p.name;
    },
    [best]
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    );
  }, [products, search]);

  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'category':
          cmp = a.category.localeCompare(b.category);
          break;
        default:
          cmp = a[sortKey] - b[sortKey];
      }
      if (cmp === 0) cmp = a.name.localeCompare(b.name); // stable tie-breaker
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filteredProducts, sortKey, sortDir]);

  const { paginatedData, pagination } = useClientPagination(sortedProducts, {
    initialPageSize: 10,
    pageSizeOptions: [10, 20, 50],
  });

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_SORT_DIR[key]);
    }
  };

  const handleOrderTypeChange = (next: OrderTypeFilter) => {
    setOrderType(next);
    if (next === 'gift') {
      setSortKey('qtyGifted');
      setSortDir('desc');
    } else if (sortKey === 'qtyGifted') {
      setSortKey('revenue');
      setSortDir('desc');
    }
  };

  const topByQty = useMemo(() => {
    const qty = (p: ProductSalesRow) => (isGiftView ? p.qtyGifted : p.qtySold);
    const top = [...products].sort((a, b) => qty(b) - qty(a)).slice(0, 8);
    const max = top[0] ? qty(top[0]) || 1 : 1;
    return top.map((p) => ({
      key: rowKey(p),
      name: p.name,
      display: `${qty(p).toLocaleString()} ${isGiftView ? 'gifted' : 'units'}`,
      ratio: qty(p) / max,
    }));
  }, [products, isGiftView]);

  const topByRevenue = useMemo(() => {
    const top = [...products].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const max = top[0]?.revenue || 1;
    return top.map((p) => ({
      key: rowKey(p),
      name: p.name,
      display: formatCurrency(p.revenue),
      ratio: p.revenue / max,
    }));
  }, [products]);

  const totalGifted = useMemo(() => products.reduce((s, p) => s + p.qtyGifted, 0), [products]);

  const exportConfig = useMemo(() => {
    const giftColumns: ColDef<ProductSalesRow>[] = [
      { header: COLUMN_LABELS.name, accessor: 'name' },
      { header: COLUMN_LABELS.category, accessor: 'category' },
      { header: COLUMN_LABELS.qtyGifted, accessor: 'qtyGifted' },
      { header: COLUMN_LABELS.qtySold, accessor: 'qtySold' },
    ];

    return {
      filenameBase: `${isGiftView ? 'gifted_items' : 'product_sales'}_${
        filterMode === 'month'
          ? `${selectedMonth.year}_${String(selectedMonth.month + 1).padStart(2, '0')}`
          : `${customStart}_${customEnd}`
      }`,
      title: isGiftView ? 'Gifted Items' : 'Product Sales',
      subtitle: periodLabel,
      columns: isGiftView
        ? giftColumns
        : ([
            { header: COLUMN_LABELS.name, accessor: 'name' as const },
            { header: COLUMN_LABELS.category, accessor: 'category' as const },
            { header: COLUMN_LABELS.qtySold, accessor: 'qtySold' as const },
            { header: 'Qty gifted', accessor: 'qtyGifted' as const },
            {
              header: COLUMN_LABELS.revenue,
              accessor: 'revenue' as const,
              format: (v: string | number | null | undefined) => Number(v).toFixed(2),
            },
            {
              header: COLUMN_LABELS.avgSellingPrice,
              accessor: 'avgSellingPrice' as const,
              format: (v: string | number | null | undefined) => Number(v).toFixed(2),
            },
            {
              header: '% of revenue',
              accessor: 'percentOfTotalRevenue' as const,
              format: (v: string | number | null | undefined) => `${Number(v).toFixed(1)}%`,
            },
          ] satisfies ColDef<ProductSalesRow>[]),
      sheetName: isGiftView ? 'Gifted Items' : 'Product Sales',
      getData: () => sortedProducts,
    };
  }, [filterMode, selectedMonth, customStart, customEnd, periodLabel, sortedProducts, isGiftView]);

  const initialLoading = loading && !report;
  const refreshing = loading && !!report;
  const hasData = products.length > 0;
  const filtersActive = category !== 'All' || orderType !== 'All' || Boolean(search.trim());
  const orderTypeLabel = ORDER_TYPE_PILLS.find((pill) => pill.value === orderType)?.label;

  const clearFilters = () => {
    setCategory('All');
    handleOrderTypeChange('All');
    setSearch('');
  };

  const showError = !loading && loadFailed;
  const showRangeHint = !loading && rangeInvalid;
  const showEmpty = !loading && !loadFailed && !rangeInvalid && !hasData;
  const showContent = !showError && !showRangeHint && !showEmpty;

  const mixValue = (p: ProductSalesRow) => (isGiftView ? p.qtyGifted : p.revenue);
  const mixTotal = products.reduce((sum, p) => sum + mixValue(p), 0);

  const categoryMix: MixRow[] = (() => {
    const groups = new Map<string, { value: number; count: number }>();
    for (const p of products) {
      const entry = groups.get(p.category) ?? { value: 0, count: 0 };
      entry.value += mixValue(p);
      entry.count += 1;
      groups.set(p.category, entry);
    }
    return [...groups.entries()]
      .sort((a, b) => b[1].value - a[1].value)
      .map(([cat, { value, count }]) => ({
        category: cat,
        count,
        share: mixTotal > 0 ? (value / mixTotal) * 100 : 0,
        display: isGiftView ? `${value.toLocaleString()} gifted` : formatCurrency(value),
      }));
  })();

  const top3 = [...products].sort((a, b) => mixValue(b) - mixValue(a)).slice(0, 3);
  const top3Share =
    mixTotal > 0 ? (top3.reduce((sum, p) => sum + mixValue(p), 0) / mixTotal) * 100 : 0;
  const priciest = products.reduce<ProductSalesRow | null>(
    (m, p) => (!m || p.avgSellingPrice > m.avgSellingPrice ? p : m),
    null
  );
  const tailCount = products.filter((p) => p.percentOfTotalRevenue < 1).length;

  const insightFacts = isGiftView
    ? [
        {
          icon: PieChart,
          label: 'Top 3 items',
          value: `${top3Share.toFixed(1)}% of gifts`,
          sub: top3.map((p) => p.name).join(', ') || '—',
        },
        {
          icon: Layers,
          label: 'Most gifted category',
          value: categoryMix[0]?.category ?? '—',
          sub: categoryMix[0]?.display ?? 'No gifts yet',
        },
        {
          icon: Gift,
          label: 'Average per item',
          value: products.length ? (totalGifted / products.length).toFixed(1) : '0',
          sub: 'Gifted units per product',
        },
      ]
    : [
        {
          icon: PieChart,
          label: 'Top 3 products',
          value: `${top3Share.toFixed(1)}% of revenue`,
          sub: top3.map((p) => p.name).join(', ') || '—',
        },
        {
          icon: Tag,
          label: 'Highest avg. price',
          value: priciest?.name ?? '—',
          sub: priciest ? formatCurrency(priciest.avgSellingPrice) : 'No sales yet',
        },
        {
          icon: Layers,
          label: 'Long tail',
          value: `${tailCount} of ${products.length} products`,
          sub: 'Each under 1% of revenue',
        },
      ];

  const searchKey = search.trim().toLowerCase();
  const toggleCategorySearch = (cat: string) =>
    setSearch(searchKey === cat.toLowerCase() ? '' : cat);

  const sortKeys = isGiftView ? GIFT_SORT_KEYS : SALES_SORT_KEYS;
  const giftShare = (p: ProductSalesRow) =>
    totalGifted > 0 ? (p.qtyGifted / totalGifted) * 100 : 0;
  const mostGifted = products.reduce<ProductSalesRow | null>(
    (m, p) => (!m || p.qtyGifted > m.qtyGifted ? p : m),
    null
  );
  const giftCategories = new Set(products.map((p) => p.category)).size;

  const kpiCards: Parameters<typeof KpiCard>[0][] = isGiftView
    ? [
        {
          label: 'Products gifted',
          value: initialLoading ? '—' : String(products.length),
          sub: 'Distinct items',
          icon: Gift,
          iconColor: 'text-pink-600',
          iconBg: 'bg-pink-50',
        },
        {
          label: 'Units gifted',
          value: initialLoading ? '—' : totalGifted.toLocaleString(),
          sub: 'Selected period and filters',
          icon: Boxes,
          iconColor: 'text-sky-600',
          iconBg: 'bg-sky-50',
        },
        {
          label: 'Most gifted',
          value: initialLoading ? '—' : (mostGifted?.name ?? '—'),
          sub: mostGifted ? `${mostGifted.qtyGifted.toLocaleString()} gifted` : 'No gifts yet',
          icon: Trophy,
          iconColor: 'text-amber-600',
          iconBg: 'bg-amber-50',
        },
        {
          label: 'Categories',
          value: initialLoading ? '—' : String(giftCategories),
          sub: 'With gifted items',
          icon: LayoutGrid,
          iconColor: 'text-indigo-600',
          iconBg: 'bg-indigo-50',
        },
      ]
    : [
        {
          label: 'Products sold',
          value: initialLoading ? '—' : String(summary?.totalProducts ?? 0),
          sub: 'Distinct items',
          icon: Package,
          iconColor: 'text-indigo-600',
          iconBg: 'bg-indigo-50',
        },
        {
          label: 'Units sold',
          value: initialLoading ? '—' : (summary?.totalUnitsSold ?? 0).toLocaleString(),
          sub:
            totalGifted > 0
              ? `${totalGifted.toLocaleString()} more gifted`
              : 'Selected period and filters',
          icon: Boxes,
          iconColor: 'text-sky-600',
          iconBg: 'bg-sky-50',
        },
        {
          label: 'Item revenue',
          value: initialLoading ? '—' : formatCurrency(summary?.totalRevenue ?? 0),
          sub: periodLabel,
          icon: Wallet,
          iconColor: 'text-emerald-600',
          iconBg: 'bg-emerald-50',
        },
        {
          label: 'Best seller',
          value: initialLoading ? '—' : (best?.name ?? '—'),
          sub: initialLoading
            ? undefined
            : best
              ? `${best.qtySold.toLocaleString()} sold · ${formatCurrency(best.revenue)}`
              : 'No sales yet',
          icon: Trophy,
          iconColor: 'text-amber-600',
          iconBg: 'bg-amber-50',
        },
      ];

  return (
    <div className="flex h-full min-h-[32rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="shrink-0 rounded-t-2xl border-b border-slate-100 bg-slate-50/60 p-4">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <div className="shrink-0 rounded-xl bg-indigo-100 p-2.5 text-indigo-600 shadow-sm">
              <BarChart3 size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-slate-800">Product sales</h2>
              <p className="flex items-center gap-1.5 text-sm text-erp-secondary">
                <Calendar size={14} aria-hidden="true" className="shrink-0" />
                <span className="truncate">{periodLabel}</span>
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center lg:w-auto">
            <div className="flex items-center self-start rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:self-auto">
              <button
                type="button"
                onClick={() => setFilterMode('month')}
                aria-pressed={filterMode === 'month'}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  filterMode === 'month'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Calendar size={13} aria-hidden="true" />
                Month
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('range')}
                aria-pressed={filterMode === 'range'}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  filterMode === 'range'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <CalendarRange size={13} aria-hidden="true" />
                Custom
              </button>
            </div>

            {filterMode === 'month' ? (
              <MonthNavigator
                label={monthLabel}
                onPrev={goToPrevMonth}
                onNext={goToNextMonth}
                disableNext={isCurrentMonth}
              />
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
                <input
                  type="date"
                  value={customStart}
                  max={todayKey}
                  aria-label="Start date"
                  onChange={(e) => handleStartChange(e.target.value)}
                  className="w-full min-w-0 bg-transparent text-sm font-medium text-slate-700 outline-none"
                />
                <ArrowRight size={14} aria-hidden="true" className="shrink-0 text-slate-300" />
                <input
                  type="date"
                  value={customEnd}
                  min={customStart}
                  max={todayKey}
                  aria-label="End date"
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full min-w-0 bg-transparent text-sm font-medium text-slate-700 outline-none"
                />
              </div>
            )}

            <div className="flex justify-end">
              <ExportDropdown config={exportConfig} disabled={loading || !hasData} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="shrink-0 space-y-3 border-b border-slate-100 bg-slate-50/60 p-4 md:px-6">
        <div role="group" aria-label="Order type" className="flex flex-wrap items-center gap-1.5">
          {ORDER_TYPE_PILLS.map(({ value, label, Icon }) => {
            const active = orderType === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => handleOrderTypeChange(value)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800'
                }`}
              >
                <Icon size={12} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center">
          <div className="relative w-full min-w-0 sm:max-w-sm sm:flex-1">
            <Search
              size={15}
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              aria-label="Search products or categories"
              placeholder="Search product or category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-[42px] w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <SelectField
            value={category}
            ariaLabel="Product category"
            onChange={(v) => setCategory(v as CategoryFilter)}
            className="min-w-[160px]"
            selectClassName="h-[42px] text-sm font-medium"
          >
            <option value="All">All categories</option>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectField>

          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-[42px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              <X size={13} aria-hidden="true" />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Body — scrolls; the table card inside takes the remaining height */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4" aria-busy={loading}>
        {showError && (
          <div
            role="alert"
            className="m-auto flex max-w-sm flex-col items-center px-4 py-10 text-center"
          >
            <div className="mb-3 inline-flex rounded-2xl bg-red-50 p-4">
              <AlertCircle size={28} className="text-red-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Couldn’t load product sales</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Check your connection and try again.
            </p>
            <button
              type="button"
              onClick={() => void loadReport()}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw size={13} aria-hidden="true" />
              Try again
            </button>
          </div>
        )}

        {showRangeHint && (
          <div className="m-auto max-w-sm px-4 py-10 text-center">
            <div className="mb-3 inline-flex rounded-2xl bg-slate-50 p-4">
              <CalendarRange size={28} className="text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-600">Pick a valid date range</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Choose a start date and an end date that is on or after it.
            </p>
          </div>
        )}

        {showEmpty && (
          <div className="m-auto max-w-sm px-4 py-10 text-center">
            <div className="mb-3 inline-flex rounded-2xl bg-slate-50 p-4">
              {isGiftView ? (
                <Gift size={28} className="text-slate-300" />
              ) : (
                <Package size={28} className="text-slate-300" />
              )}
            </div>
            <p className="text-sm font-semibold text-slate-600">
              {isGiftView
                ? 'No gifted items in this period'
                : category !== 'All' || orderType !== 'All'
                  ? 'No sales match these filters'
                  : 'No product sales in this period'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              {isGiftView
                ? 'Items given away at no charge on POS orders appear here.'
                : 'Completed POS orders with line items appear here. Delivery payouts are not menu items, so they stay on Accounts → Delivery Payouts.'}
            </p>
            {(category !== 'All' || orderType !== 'All') && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {showContent && (
          <>
            {/* KPIs */}
            <div className="grid shrink-0 grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
              {kpiCards.map((card) => (
                <KpiCard key={card.label} {...card} />
              ))}
            </div>

            {/* Insights */}
            <section className="shrink-0 overflow-hidden rounded-xl border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Insights</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Top products and category mix for the selected period, category and order type.
                    Search filters the table only.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInsightsOpen((open) => !open)}
                  aria-expanded={insightsOpen}
                  aria-controls="product-sales-insights"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  {insightsOpen ? 'Hide breakdown' : 'View breakdown'}
                  <ChevronDown
                    size={14}
                    aria-hidden="true"
                    className={`transition-transform ${insightsOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>
              <div id="product-sales-insights" hidden={!insightsOpen} className="p-3">
                {insightsOpen && initialLoading && (
                  <p role="status" className="p-4 text-sm text-slate-500">
                    Loading insights…
                  </p>
                )}
                {insightsOpen && !initialLoading && topByQty.length > 0 && (
                  <div
                    className={`grid grid-cols-1 gap-4 transition-opacity xl:grid-cols-5 ${
                      refreshing ? 'opacity-60' : ''
                    }`}
                  >
                    <RankedBars
                      title={
                        isGiftView
                          ? 'Top 8 products by gifted quantity'
                          : 'Top 8 products by quantity'
                      }
                      rows={topByQty}
                      valueClass={isGiftView ? 'text-pink-600' : 'text-indigo-700'}
                      className={isGiftView ? 'xl:col-span-5' : 'xl:col-span-3'}
                    />
                    {!isGiftView && (
                      <RankedBars
                        title="Top 5 products by revenue"
                        rows={topByRevenue}
                        valueClass="text-emerald-600"
                        className="xl:col-span-2"
                      />
                    )}
                    <CategoryMix
                      title={isGiftView ? 'Gifts by category' : 'Revenue by category'}
                      rows={categoryMix}
                      activeSearch={searchKey}
                      onSelect={toggleCategorySearch}
                      barClass={isGiftView ? 'bg-pink-500' : 'bg-indigo-500'}
                      className="xl:col-span-3"
                    />
                    <InsightFacts
                      title="At a glance"
                      facts={insightFacts}
                      className="xl:col-span-2"
                    />
                  </div>
                )}
              </div>
            </section>

            {/* Table heading + mobile sort */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  {isGiftView ? 'Gifted items' : 'Product breakdown'}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {periodLabel} · {category === 'All' ? 'All categories' : category} ·{' '}
                  {orderTypeLabel}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:hidden">
                <label htmlFor="product-sales-sort" className="text-xs font-medium text-slate-500">
                  Sort by
                </label>
                <SelectField
                  id="product-sales-sort"
                  value={sortKey}
                  onChange={(v) => handleSort(v as SortKey)}
                  selectClassName="h-9 rounded-lg text-xs"
                >
                  {sortKeys.map((key) => (
                    <option key={key} value={key}>
                      {COLUMN_LABELS[key]}
                    </option>
                  ))}
                </SelectField>
                <button
                  type="button"
                  onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  aria-label={`Sorted ${sortDir === 'asc' ? 'ascending' : 'descending'}. Tap to reverse.`}
                  className="rounded-lg border border-slate-200 p-2 text-slate-600"
                >
                  {sortDir === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                </button>
              </div>
            </div>

            {/* Table card — fills remaining height on desktop */}
            <div className="flex shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 lg:min-h-[360px] lg:shrink lg:flex-1">
              {/* Desktop table */}
              <div
                className={`hidden min-h-0 flex-1 overflow-auto transition-opacity lg:block [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 ${
                  refreshing ? 'opacity-60' : ''
                }`}
              >
                <table className="w-full min-w-[820px] text-left">
                  <caption className="sr-only">
                    Product sales for {periodLabel}, sorted by {COLUMN_LABELS[sortKey]}{' '}
                    {sortDir === 'asc' ? 'ascending' : 'descending'}
                  </caption>
                  <thead className="sticky top-0 z-10 border-b-2 border-slate-200 bg-slate-50">
                    <tr>
                      <th
                        scope="col"
                        className="w-10 bg-slate-50 px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:px-5"
                      >
                        #
                      </th>
                      <SortHeader
                        sortKey="name"
                        activeKey={sortKey}
                        dir={sortDir}
                        onSort={handleSort}
                      />
                      <SortHeader
                        sortKey="category"
                        activeKey={sortKey}
                        dir={sortDir}
                        onSort={handleSort}
                      />
                      {isGiftView ? (
                        <>
                          <SortHeader
                            sortKey="qtyGifted"
                            activeKey={sortKey}
                            dir={sortDir}
                            onSort={handleSort}
                            align="right"
                          />
                          <SortHeader
                            sortKey="qtySold"
                            activeKey={sortKey}
                            dir={sortDir}
                            onSort={handleSort}
                            align="right"
                          />
                          <th
                            scope="col"
                            className="bg-slate-50 px-4 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:px-5"
                          >
                            Share of gifts
                          </th>
                        </>
                      ) : (
                        <>
                          <SortHeader
                            sortKey="qtySold"
                            activeKey={sortKey}
                            dir={sortDir}
                            onSort={handleSort}
                            align="right"
                          />
                          <SortHeader
                            sortKey="revenue"
                            activeKey={sortKey}
                            dir={sortDir}
                            onSort={handleSort}
                            align="right"
                          />
                          <SortHeader
                            sortKey="avgSellingPrice"
                            activeKey={sortKey}
                            dir={sortDir}
                            onSort={handleSort}
                            align="right"
                          />
                          <SortHeader
                            sortKey="percentOfTotalRevenue"
                            activeKey={sortKey}
                            dir={sortDir}
                            onSort={handleSort}
                            align="right"
                          />
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {initialLoading ? (
                      <SkeletonRows />
                    ) : paginatedData.length > 0 ? (
                      paginatedData.map((p, idx) => {
                        const badge = categoryBadge(p.category);
                        const rank = (pagination.currentPage - 1) * pagination.pageSize + idx + 1;
                        const isBest = isBestSeller(p);
                        return (
                          <tr
                            key={rowKey(p)}
                            className={`transition-colors hover:bg-indigo-50/40 ${
                              isBest
                                ? 'bg-amber-50/40'
                                : idx % 2 === 0
                                  ? 'bg-white'
                                  : 'bg-slate-50/40'
                            }`}
                          >
                            <td className="px-4 py-3.5 text-xs font-bold text-slate-400 tabular-nums sm:px-5">
                              {rank}
                            </td>
                            <td className="px-4 py-3.5 sm:px-5">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="truncate text-sm font-semibold text-slate-800">
                                  {p.name}
                                </span>
                                {isBest && (
                                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                                    <Trophy size={10} aria-hidden="true" />
                                    Best
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 sm:px-5">
                              <span
                                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold ${badge.badge}`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                                {p.category}
                              </span>
                            </td>
                            {isGiftView ? (
                              <>
                                <td className="px-4 py-3.5 text-right sm:px-5">
                                  <span className="inline-flex items-center gap-1 text-sm font-extrabold text-pink-600 tabular-nums">
                                    <Gift size={12} aria-hidden="true" />
                                    {p.qtyGifted.toLocaleString()}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 text-right text-sm font-semibold text-slate-700 tabular-nums sm:px-5">
                                  {p.qtySold.toLocaleString()}
                                </td>
                                <td className="px-4 py-3.5 text-right sm:px-5">
                                  <div className="flex items-center justify-end gap-2">
                                    <div
                                      aria-hidden="true"
                                      className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100"
                                    >
                                      <div
                                        className="h-full rounded-full bg-pink-500"
                                        style={{ width: `${Math.min(giftShare(p), 100)}%` }}
                                      />
                                    </div>
                                    <span className="w-12 text-right text-xs font-semibold text-slate-600 tabular-nums">
                                      {giftShare(p).toFixed(1)}%
                                    </span>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-4 py-3.5 text-right sm:px-5">
                                  <span className="text-sm font-semibold text-slate-700 tabular-nums">
                                    {p.qtySold.toLocaleString()}
                                  </span>
                                  {p.qtyGifted > 0 && (
                                    <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600">
                                      <Gift size={10} aria-hidden="true" />
                                      {p.qtyGifted.toLocaleString()} gifted
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3.5 text-right text-sm font-extrabold text-slate-800 tabular-nums sm:px-5">
                                  {formatCurrency(p.revenue)}
                                </td>
                                <td className="px-4 py-3.5 text-right text-xs font-medium text-slate-500 tabular-nums sm:px-5">
                                  {formatCurrency(p.avgSellingPrice)}
                                </td>
                                <td className="px-4 py-3.5 text-right sm:px-5">
                                  <div className="flex items-center justify-end gap-2">
                                    <div
                                      aria-hidden="true"
                                      className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100"
                                    >
                                      <div
                                        className="h-full rounded-full bg-indigo-500"
                                        style={{
                                          width: `${Math.max(0, Math.min(p.percentOfTotalRevenue, 100))}%`,
                                        }}
                                      />
                                    </div>
                                    <span className="w-12 text-right text-xs font-semibold text-slate-600 tabular-nums">
                                      {p.percentOfTotalRevenue.toFixed(1)}%
                                    </span>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={isGiftView ? 6 : 7} className="px-4 py-14 text-center">
                          <p className="text-sm font-semibold text-slate-500">
                            No products match this search
                          </p>
                          <button
                            type="button"
                            onClick={() => setSearch('')}
                            className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                          >
                            Clear search
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile / tablet cards */}
              <div
                className={`divide-y divide-slate-100 transition-opacity lg:hidden ${
                  refreshing ? 'opacity-60' : ''
                }`}
              >
                {initialLoading ? (
                  <p role="status" className="p-6 text-center text-sm text-slate-500">
                    Loading product sales…
                  </p>
                ) : paginatedData.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-sm text-slate-500">No products match this search</p>
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="mt-2 text-sm font-semibold text-indigo-600"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  paginatedData.map((item, index) => (
                    <article key={rowKey(item)} className="min-w-0 p-4">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 text-xs font-bold text-slate-400 tabular-nums">
                          {(pagination.currentPage - 1) * pagination.pageSize + index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h4 className="break-words text-sm font-semibold text-slate-800">
                            {item.name}
                          </h4>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold ${categoryBadge(item.category).badge}`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${categoryBadge(item.category).dot}`}
                              />
                              {item.category}
                            </span>
                            {isBestSeller(item) && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                                <Trophy size={10} aria-hidden="true" />
                                Best
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {isGiftView ? (
                        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                          <div>
                            <dt className="text-slate-500">{COLUMN_LABELS.qtyGifted}</dt>
                            <dd className="mt-1 inline-flex items-center gap-1 font-bold text-pink-600 tabular-nums">
                              <Gift size={12} aria-hidden="true" />
                              {item.qtyGifted.toLocaleString()}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">{COLUMN_LABELS.qtySold}</dt>
                            <dd className="mt-1 font-semibold text-slate-700 tabular-nums">
                              {item.qtySold.toLocaleString()}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Share of gifts</dt>
                            <dd className="mt-1 font-semibold text-slate-700 tabular-nums">
                              {giftShare(item).toFixed(1)}%
                            </dd>
                          </div>
                        </dl>
                      ) : (
                        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                          <div>
                            <dt className="text-slate-500">{COLUMN_LABELS.qtySold}</dt>
                            <dd className="mt-1 font-semibold text-slate-800 tabular-nums">
                              {item.qtySold.toLocaleString()}
                              {item.qtyGifted > 0 && (
                                <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600">
                                  <Gift size={10} aria-hidden="true" />
                                  {item.qtyGifted.toLocaleString()} gifted
                                </span>
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">{COLUMN_LABELS.revenue}</dt>
                            <dd className="mt-1 break-words font-bold text-slate-800 tabular-nums">
                              {formatCurrency(item.revenue)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">{COLUMN_LABELS.avgSellingPrice}</dt>
                            <dd className="mt-1 break-words font-semibold text-slate-700 tabular-nums">
                              {formatCurrency(item.avgSellingPrice)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">
                              {COLUMN_LABELS.percentOfTotalRevenue}
                            </dt>
                            <dd className="mt-1 font-semibold text-slate-700 tabular-nums">
                              {item.percentOfTotalRevenue.toFixed(1)}%
                            </dd>
                          </div>
                        </dl>
                      )}
                    </article>
                  ))
                )}
              </div>

              {/* Footer */}
              {sortedProducts.length > 0 && (
                <div className="flex shrink-0 flex-col items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-4 py-3.5 sm:px-5 md:flex-row">
                  <p className="w-full text-center text-xs text-slate-500 md:text-left">
                    <span className="font-bold text-slate-700">{sortedProducts.length}</span>{' '}
                    product{sortedProducts.length !== 1 ? 's' : ''}
                    {search.trim() && products.length !== sortedProducts.length && (
                      <span> of {products.length}</span>
                    )}
                    {' · '}
                    <span className="font-bold text-indigo-600">
                      {isGiftView
                        ? sortedProducts.reduce((s, p) => s + p.qtyGifted, 0).toLocaleString()
                        : formatCurrency(sortedProducts.reduce((s, p) => s + p.revenue, 0))}
                    </span>{' '}
                    {isGiftView ? 'units gifted in this view' : 'in this view'}
                  </p>
                  <div className="w-full md:w-auto">
                    <Pagination pagination={pagination} showPageInfo={false} />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
