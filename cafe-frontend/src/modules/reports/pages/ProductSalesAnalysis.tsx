/**
 * Product Sales Analysis — monthly (or custom-range) breakdown of individual
 * product performance: quantity sold, revenue, average price, and revenue
 * share, with an optional order-type / category filter.
 *
 * Backend-driven: calls GET /api/reports/product-sales so the client never
 * needs to hold the entire sales ledger for this view.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  X,
  Calendar,
  CalendarRange,
  Package,
  Layers,
  Wallet,
  Award,
  BarChart3,
  Store,
  Coffee,
  Bike,
  Gift,
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
import { EnhancedBarChart } from '@/shared/components/ui/AdvancedCharts';
import { useClientPagination } from '@/shared/hooks';
import { handleError, formatCurrency, todayBusinessKey } from '@/shared/utils';
import { ExportDropdown } from '@/shared/export';
import type { ColDef } from '@/shared/export';

// ─── Types & config ───────────────────────────────────────────────────────────

type FilterMode = 'month' | 'range';
type OrderTypeFilter = 'All' | 'in_store' | 'takeaway' | 'delivery';
type CategoryFilter = MenuCategory | 'All';
type SortKey = 'name' | 'category' | 'qtySold' | 'revenue' | 'avgSellingPrice' | 'percentOfTotalRevenue';

const ORDER_TYPE_PILLS: { value: OrderTypeFilter; label: string; Icon: LucideIcon }[] = [
  { value: 'All', label: 'All types', Icon: Layers },
  { value: 'in_store', label: 'Dine in', Icon: Store },
  { value: 'takeaway', label: 'Takeaway', Icon: Coffee },
  { value: 'delivery', label: 'Delivery', Icon: Bike },
];

interface SelectedMonth {
  year: number;
  month: number;
}

function categoryBadge(category: string) {
  const style = CATEGORY_STYLES[category as MenuCategory];
  if (!style) return { badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' };
  return style;
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

function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const isActive = sortKey === activeKey;
  const Icon = isActive ? (dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <th
      className={`px-4 sm:px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-slate-800 transition-colors ${
          align === 'right' ? 'flex-row-reverse' : ''
        } ${isActive ? 'text-indigo-700' : ''}`}
      >
        {label}
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
    <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className={`p-2.5 rounded-xl shrink-0 ${iconBg}`}>
        <Icon size={18} strokeWidth={2.5} className={iconColor} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1.5 truncate">
          {label}
        </p>
        <p className="text-lg sm:text-xl font-extrabold text-slate-800 tabular-nums tracking-tight leading-none truncate" title={value}>
          {value}
        </p>
        {sub && <p className="text-[11px] text-slate-400 mt-1.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function SkeletonBar() {
  return <div className="h-4 w-24 bg-slate-100 rounded-md animate-pulse" />;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ProductSalesAnalysis() {
  const now = new Date();

  const [filterMode, setFilterMode] = useState<FilterMode>('month');
  const [selectedMonth, setSelectedMonth] = useState<SelectedMonth>({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [customStart, setCustomStart] = useState(todayBusinessKey());
  const [customEnd, setCustomEnd] = useState(todayBusinessKey());

  const [category, setCategory] = useState<CategoryFilter>('All');
  const [orderType, setOrderType] = useState<OrderTypeFilter>('All');
  const [search, setSearch] = useState('');

  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [report, setReport] = useState<ProductSalesReport | null>(null);
  const [loading, setLoading] = useState(true);

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

  const periodLabel = useMemo(() => {
    if (filterMode === 'month') return monthLabel;
    if (!customStart || !customEnd) return 'Custom range';
    if (customStart === customEnd) {
      return new Date(`${customStart}T12:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    return `${customStart} → ${customEnd}`;
  }, [filterMode, monthLabel, customStart, customEnd]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const query =
        filterMode === 'month'
          ? { month: `${selectedMonth.year}-${String(selectedMonth.month + 1).padStart(2, '0')}` }
          : { startDate: customStart || undefined, endDate: customEnd || undefined };

      const data = await reportsService.getProductSalesReport({
        ...query,
        category: category !== 'All' ? category : undefined,
        posChannel: orderType !== 'All' ? orderType : undefined,
      });
      setReport(data);
    } catch (error) {
      handleError(error, { action: 'load_product_sales_report', severity: 'medium' });
    } finally {
      setLoading(false);
    }
  }, [filterMode, selectedMonth, customStart, customEnd, category, orderType]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const products = useMemo(() => report?.products ?? [], [report]);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.trim().toLowerCase();
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
      setSortDir('desc');
    }
  };

  const topByQty = useMemo(
    () =>
      [...products]
        .sort((a, b) => b.qtySold - a.qtySold)
        .slice(0, 8)
        .map((p) => ({ name: p.name, value: p.qtySold })),
    [products]
  );

  const topByRevenue = useMemo(
    () => [...products].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    [products]
  );

  const exportConfig = useMemo(
    () => ({
      filenameBase: `product_sales_${filterMode === 'month' ? `${selectedMonth.year}_${selectedMonth.month + 1}` : `${customStart}_${customEnd}`}`,
      title: 'Product Sales Analysis',
      subtitle: periodLabel,
      columns: [
        { header: 'Product', accessor: 'name' as const },
        { header: 'Category', accessor: 'category' as const },
        { header: 'Qty Sold', accessor: 'qtySold' as const },
        { header: 'Qty Gifted', accessor: 'qtyGifted' as const },
        {
          header: 'Revenue',
          accessor: 'revenue' as const,
          format: (v: string | number | null | undefined) => Number(v).toFixed(2),
        },
        {
          header: 'Avg. Price',
          accessor: 'avgSellingPrice' as const,
          format: (v: string | number | null | undefined) => Number(v).toFixed(2),
        },
        {
          header: '% of Revenue',
          accessor: 'percentOfTotalRevenue' as const,
          format: (v: string | number | null | undefined) => `${Number(v).toFixed(1)}%`,
        },
      ] satisfies ColDef<ProductSalesRow>[],
      sheetName: 'Product Sales',
      getData: () => sortedProducts,
    }),
    [filterMode, selectedMonth, customStart, customEnd, periodLabel, sortedProducts]
  );

  const summary = report?.summary;
  const hasData = products.length > 0;
  const filtersActive = category !== 'All' || orderType !== 'All' || Boolean(search.trim());

  const clearFilters = () => {
    setCategory('All');
    setOrderType('All');
    setSearch('');
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 pb-16 sm:pb-0">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-slate-100 bg-gradient-to-r from-indigo-50 via-white to-slate-50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-indigo-100 rounded-xl text-indigo-600 shadow-sm shrink-0">
              <BarChart3 size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">
                Product Sales Analysis
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                <Calendar size={12} />
                What sold, how much, and which items carry the period
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <div className="flex justify-end">
              <ExportDropdown config={exportConfig} disabled={!hasData} />
            </div>
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setFilterMode('month')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  filterMode === 'month' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Month
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('range')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                  filterMode === 'range' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <CalendarRange size={13} />
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
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-2 py-1.5 shadow-sm">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="text-sm font-medium text-slate-700 outline-none bg-transparent"
                />
                <span className="text-slate-300">→</span>
                <input
                  type="date"
                  value={customEnd}
                  min={customStart}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="text-sm font-medium text-slate-700 outline-none bg-transparent"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 md:px-6 md:py-4 border-b border-slate-100 bg-slate-50/60 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {ORDER_TYPE_PILLS.map(({ value, label, Icon }) => {
            const active = orderType === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setOrderType(value)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  active
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-800'
                }`}
              >
                <Icon size={12} />
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by product or category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CategoryFilter)}
            className="h-[42px] px-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-200 text-sm font-medium cursor-pointer min-w-[160px]"
          >
            <option value="All">All categories</option>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="h-[42px] px-3 text-xs font-semibold text-slate-500 hover:text-slate-800 border border-slate-200 bg-white rounded-xl"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Empty */}
      {!loading && !hasData && (
        <div className="px-4 py-16 text-center">
          <div className="inline-flex p-4 bg-slate-50 rounded-2xl mb-3">
            <Package size={28} className="text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-600">No product sales in this period</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
            Completed POS orders with line items appear here. Delivery settlements are payouts, not
            menu items, so they stay on Finance → Delivery Settlements.
          </p>
        </div>
      )}

      {(loading || hasData) && (
        <div className="p-4 md:p-6 space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <KpiCard
              label="Products sold"
              value={loading ? '—' : String(summary?.totalProducts ?? 0)}
              sub="Distinct items"
              icon={Package}
              iconColor="text-indigo-600"
              iconBg="bg-indigo-50"
            />
            <KpiCard
              label="Units sold"
              value={loading ? '—' : (summary?.totalUnitsSold ?? 0).toLocaleString()}
              sub="Across every ticket"
              icon={Layers}
              iconColor="text-sky-600"
              iconBg="bg-sky-50"
            />
            <KpiCard
              label="Item revenue"
              value={loading ? '—' : formatCurrency(summary?.totalRevenue ?? 0)}
              sub={periodLabel}
              icon={Wallet}
              iconColor="text-emerald-600"
              iconBg="bg-emerald-50"
            />
            <KpiCard
              label="Best seller"
              value={loading ? '—' : summary?.bestSellingProduct?.name ?? '—'}
              sub={
                summary?.bestSellingProduct
                  ? `${summary.bestSellingProduct.qtySold} sold · ${formatCurrency(summary.bestSellingProduct.revenue)}`
                  : 'No sales yet'
              }
              icon={Award}
              iconColor="text-amber-600"
              iconBg="bg-amber-50"
            />
          </div>

          {!loading && topByQty.length > 0 && (
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
              <div className="xl:col-span-3 bg-slate-50/80 border border-slate-100 rounded-2xl p-4 sm:p-5">
                <EnhancedBarChart data={topByQty} title="Top products by quantity" />
              </div>
              <div className="xl:col-span-2 bg-slate-50/80 border border-slate-100 rounded-2xl p-4 sm:p-5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                  Top 5 by revenue
                </p>
                <div className="space-y-3">
                  {topByRevenue.map((item, index) => {
                    const max = topByRevenue[0]?.revenue || 1;
                    return (
                      <div key={item.menuItemId ?? item.name} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 text-[11px] font-black text-slate-400 tabular-nums shrink-0">
                              #{index + 1}
                            </span>
                            <span className="text-sm font-semibold text-slate-700 truncate">
                              {item.name}
                            </span>
                          </div>
                          <span className="text-sm font-bold text-emerald-600 tabular-nums shrink-0">
                            {formatCurrency(item.revenue)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-white rounded-full overflow-hidden border border-slate-100">
                          <div
                            className="h-full rounded-full bg-indigo-400"
                            style={{ width: `${Math.min(100, (item.revenue / max) * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {loading && !hasData && (
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
              <div className="xl:col-span-3 h-64 bg-slate-50 rounded-2xl animate-pulse" />
              <div className="xl:col-span-2 h-64 bg-slate-50 rounded-2xl animate-pulse" />
            </div>
          )}

          {/* Table */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto max-h-[560px] scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
              <table className="w-full text-left min-w-[820px]">
                <thead className="bg-slate-50 border-b-2 border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 sm:px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-10">
                      #
                    </th>
                    <SortHeader label="Product" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortHeader
                      label="Category"
                      sortKey="category"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={handleSort}
                    />
                    <SortHeader
                      label="Qty"
                      sortKey="qtySold"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={handleSort}
                      align="right"
                    />
                    <SortHeader
                      label="Revenue"
                      sortKey="revenue"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={handleSort}
                      align="right"
                    />
                    <SortHeader
                      label="Avg. price"
                      sortKey="avgSellingPrice"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={handleSort}
                      align="right"
                    />
                    <SortHeader
                      label="Share"
                      sortKey="percentOfTotalRevenue"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={handleSort}
                      align="right"
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10">
                        <div className="flex flex-col items-center gap-2">
                          <SkeletonBar />
                          <p className="text-xs text-slate-400">Loading product sales…</p>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedData.length > 0 ? (
                    paginatedData.map((p, idx) => {
                      const badge = categoryBadge(p.category);
                      const rank = (pagination.currentPage - 1) * pagination.pageSize + idx + 1;
                      const isBest = summary?.bestSellingProduct?.name === p.name;
                      return (
                        <tr
                          key={p.menuItemId ?? p.name}
                          className={`hover:bg-indigo-50/40 transition-colors ${
                            isBest ? 'bg-amber-50/40' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                          }`}
                        >
                          <td className="px-4 sm:px-5 py-3.5 text-xs font-bold text-slate-400 tabular-nums">
                            {rank}
                          </td>
                          <td className="px-4 sm:px-5 py-3.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-semibold text-slate-800 truncate">
                                {p.name}
                              </span>
                              {isBest && (
                                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-md">
                                  Best
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 sm:px-5 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md whitespace-nowrap ${badge.badge}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                              {p.category}
                            </span>
                          </td>
                          <td className="px-4 sm:px-5 py-3.5 text-right">
                            <span className="text-sm font-semibold text-slate-700 tabular-nums">
                              {p.qtySold.toLocaleString()}
                            </span>
                            {p.qtyGifted > 0 && (
                              <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600">
                                <Gift size={10} />
                                {p.qtyGifted}
                              </span>
                            )}
                          </td>
                          <td className="px-4 sm:px-5 py-3.5 text-right text-sm font-extrabold text-slate-800 tabular-nums">
                            {formatCurrency(p.revenue)}
                          </td>
                          <td className="px-4 sm:px-5 py-3.5 text-right text-xs font-medium text-slate-500 tabular-nums">
                            {formatCurrency(p.avgSellingPrice)}
                          </td>
                          <td className="px-4 sm:px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                                <div
                                  className="h-full bg-indigo-500 rounded-full"
                                  style={{ width: `${Math.min(p.percentOfTotalRevenue, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-slate-600 tabular-nums w-12 text-right">
                                {p.percentOfTotalRevenue.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-14 text-center">
                        <p className="text-sm font-semibold text-slate-500">No products match this search</p>
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

            {sortedProducts.length > 0 && (
              <div className="px-4 sm:px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-xs text-slate-500 w-full text-center md:text-left">
                  <span className="font-bold text-slate-700">{sortedProducts.length}</span> product
                  {sortedProducts.length !== 1 ? 's' : ''}
                  {search.trim() && products.length !== sortedProducts.length && (
                    <span> of {products.length}</span>
                  )}
                  {' · '}
                  <span className="font-bold text-indigo-600">
                    {formatCurrency(sortedProducts.reduce((s, p) => s + p.revenue, 0))}
                  </span>{' '}
                  in this view
                </p>
                <div className="w-full md:w-auto">
                  <Pagination pagination={pagination} showPageInfo={false} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
