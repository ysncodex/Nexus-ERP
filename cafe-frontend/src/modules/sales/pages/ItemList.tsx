import { useState, useMemo, useCallback, useEffect, memo } from 'react';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  ToggleLeft,
  ToggleRight,
  ListFilter,
  Package,
  LayoutGrid,
  List,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCanMutate } from '@/shared/hooks';
import { menuService } from '@/core/api/services';
import { clearLegacyPosStorage } from '../utils/posStorageMigration';
import {
  ALL_CATEGORIES,
  CATEGORY_STYLES,
  UNAVAILABLE_FILTER_STYLE,
  type MenuItem,
  type MenuCategory,
  type ItemListFilter,
} from '../types/menuItem.types';
// ─── Category dot component ──────────────────────────────────────────────────
function CategoryDot({ category }: { category: MenuCategory }) {
  const style = CATEGORY_STYLES[category];
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
      <span className={`text-[10px] font-bold uppercase tracking-wider ${style.text}`}>
        {category}
      </span>
    </span>
  );
}
// ─── Add / Edit Modal ────────────────────────────────────────────────────────
interface ItemFormModalProps {
  item?: MenuItem;
  onSave: (data: Omit<MenuItem, 'id'>) => void;
  onClose: () => void;
}
function ItemFormModal({ item, onSave, onClose }: ItemFormModalProps) {
  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState<MenuCategory>(item?.category ?? 'Coffee');
  const [price, setPrice] = useState(item?.price.toString() ?? '');
  const [available, setAvailable] = useState(item?.available ?? true);
  const [description, setDescription] = useState(item?.description ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Item name is required';
    const p = parseFloat(price);
    if (isNaN(p) || p <= 0) e.price = 'Enter a valid price greater than 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      name: name.trim(),
      category,
      price: parseFloat(price),
      available,
      description: description.trim() || undefined,
    });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            {item ? 'Edit Item' : 'Add New Item'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={18} className="text-slate-500" />
          </button>
        </div>
        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-4"
        >
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Item Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hazelnut Latte"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                errors.name
                  ? 'border-red-400 focus:ring-2 focus:ring-red-200'
                  : 'border-slate-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100'
              }`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>
          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MenuCategory)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all bg-white"
            >
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {/* Price */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Price (৳)</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              min="0"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                errors.price
                  ? 'border-red-400 focus:ring-2 focus:ring-red-200'
                  : 'border-slate-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100'
              }`}
            />
            {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price}</p>}
          </div>
          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Description <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Short description..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all resize-none"
            />
          </div>
          {/* Availability */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <span className="text-sm font-semibold text-slate-700">Available for Order</span>
            <button
              type="button"
              onClick={() => setAvailable(!available)}
              className="flex items-center gap-2 transition-colors"
            >
              {available ? (
                <ToggleRight size={28} className="text-emerald-500" />
              ) : (
                <ToggleLeft size={28} className="text-slate-400" />
              )}
              <span
                className={`text-sm font-medium ${available ? 'text-emerald-600' : 'text-slate-400'}`}
              >
                {available ? 'Yes' : 'No'}
              </span>
            </button>
          </div>
          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Check size={16} />
              {item ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
// ─── Product Card ────────────────────────────────────────────────────────────
interface ProductCardProps {
  item: MenuItem;
  onEdit: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
  onToggle: (item: MenuItem) => void;
  readOnly?: boolean;
}
function AvailabilityBadge({ available }: { available: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold ${available ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${available ? 'bg-emerald-500' : 'bg-rose-500'}`}
      />
      {available ? 'Available' : 'Unavailable'}
    </span>
  );
}

function ProductActions({ item, onEdit, onDelete, onToggle, readOnly = false }: ProductCardProps) {
  if (readOnly) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={() => onEdit(item)}
        aria-label={`Edit ${item.name}`}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        <Pencil size={13} /> Edit
      </button>
      <button
        type="button"
        onClick={() => onToggle(item)}
        aria-label={`${item.available ? 'Mark unavailable' : 'Mark available'}: ${item.name}`}
        title={item.available ? 'Mark unavailable' : 'Mark available'}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-amber-50 hover:text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        {item.available ? <ToggleRight size={19} /> : <ToggleLeft size={19} />}
      </button>
      <button
        type="button"
        onClick={() => onDelete(item)}
        aria-label={`Delete ${item.name}`}
        title="Delete item"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

const ProductCard = memo(function ProductCard(props: ProductCardProps) {
  const { item, readOnly } = props;
  return (
    <article className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-3.5">
      <CategoryDot category={item.category} />
      <h3 className="mt-2 break-words text-sm font-semibold leading-snug text-slate-800">
        {item.name}
      </h3>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
        <span className="text-base font-bold tabular-nums text-slate-900">
          ৳{item.price.toLocaleString('en-BD')}
        </span>
        <AvailabilityBadge available={item.available} />
      </div>
      {!readOnly && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <ProductActions {...props} />
        </div>
      )}
    </article>
  );
});

interface ProductTableProps {
  items: MenuItem[];
  onEdit: ProductCardProps['onEdit'];
  onDelete: ProductCardProps['onDelete'];
  onToggle: ProductCardProps['onToggle'];
  readOnly: boolean;
}

function ProductTable({ items, onEdit, onDelete, onToggle, readOnly }: ProductTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full table-fixed text-left text-sm">
        <caption className="sr-only">
          Products with prices, availability, and permitted actions
        </caption>
        <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="px-3 py-3 sm:px-4">
              Product
            </th>
            <th scope="col" className="hidden w-[18%] px-3 py-3 md:table-cell">
              Category
            </th>
            <th scope="col" className="w-20 px-2 py-3 text-right sm:w-28 sm:px-4">
              Price
            </th>
            <th scope="col" className="w-28 px-2 py-3 sm:w-32 sm:px-4">
              Availability
            </th>
            {!readOnly && (
              <th scope="col" className="hidden w-44 px-4 py-3 xl:table-cell">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.id} className="align-top transition-colors hover:bg-slate-50/70">
              <th scope="row" className="px-3 py-3 font-normal sm:px-4">
                <span className="block break-words font-semibold leading-snug text-slate-800">
                  {item.name}
                </span>
                <div className="mt-1.5 md:hidden">
                  <CategoryDot category={item.category} />
                </div>
                {!readOnly && (
                  <div className="mt-2 xl:hidden">
                    <ProductActions
                      item={item}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onToggle={onToggle}
                    />
                  </div>
                )}
              </th>
              <td className="hidden px-3 py-3 md:table-cell">
                <CategoryDot category={item.category} />
              </td>
              <td className="break-words px-2 py-3 text-right font-semibold tabular-nums text-slate-800 sm:px-4">
                ৳{item.price.toLocaleString('en-BD')}
              </td>
              <td className="px-2 py-3 sm:px-4">
                <AvailabilityBadge available={item.available} />
              </td>
              {!readOnly && (
                <td className="hidden px-4 py-3 xl:table-cell">
                  <ProductActions
                    item={item}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onToggle={onToggle}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Delete Confirm Modal ────────────────────────────────────────────────────
function DeleteConfirmModal({
  item,
  onConfirm,
  onCancel,
}: {
  item: MenuItem;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 size={22} className="text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Delete Item?</h3>
        <p className="text-sm text-slate-500 mb-5">
          "<strong>{item.name}</strong>" will be permanently removed from the menu.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ItemList() {
  const canMutate = useCanMutate();
  const [catalog, setCatalog] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<ItemListFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<MenuItem | null>(null);
  const refreshCatalog = useCallback(async () => {
    try {
      const items = await menuService.getAll();
      setCatalog(items);
    } catch {
      toast.error('Failed to load menu from server');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    clearLegacyPosStorage();
    void refreshCatalog();
  }, [refreshCatalog]);
  // ── Filtered items ──
  const filtered = useMemo(() => {
    let items = catalog;
    if (selectedCategory === 'Unavailable') {
      items = items.filter((i) => !i.available);
    } else if (selectedCategory !== 'All') {
      items = items.filter((i) => i.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (i) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)
      );
    }
    return items;
  }, [catalog, selectedCategory, searchQuery]);
  // ── Category counts ──
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: catalog.length,
      Unavailable: catalog.filter((i) => !i.available).length,
    };
    ALL_CATEGORIES.forEach((cat) => {
      counts[cat] = catalog.filter((i) => i.category === cat).length;
    });
    return counts;
  }, [catalog]);
  const availableCount = catalog.filter((i) => i.available).length;
  const unavailableCount = catalog.length - availableCount;
  const totalCategories = new Set(catalog.map((i) => i.category)).size;
  // ── Handlers ──
  const handleAdd = useCallback(
    async (data: Omit<MenuItem, 'id'>) => {
      try {
        const newItem = await menuService.create(data);
        await refreshCatalog();
        setShowAddModal(false);
        toast.success(`"${newItem.name}" added to menu`);
      } catch {
        toast.error('Failed to add item');
      }
    },
    [refreshCatalog]
  );
  const handleEdit = useCallback(
    async (data: Omit<MenuItem, 'id'>) => {
      if (!editingItem) return;
      try {
        await menuService.update(editingItem.id, data);
        await refreshCatalog();
        setEditingItem(null);
        toast.success('Item updated');
      } catch {
        toast.error('Failed to update item');
      }
    },
    [editingItem, refreshCatalog]
  );
  const handleDelete = useCallback(async () => {
    if (!deletingItem) return;
    try {
      await menuService.delete(deletingItem.id);
      await refreshCatalog();
      setDeletingItem(null);
      toast.success(`"${deletingItem.name}" removed`);
    } catch {
      toast.error('Failed to delete item');
    }
  }, [deletingItem, refreshCatalog]);
  const handleToggle = useCallback(
    async (item: MenuItem) => {
      // FIX: Optimistic UI updates. We flip the boolean immediately locally,
      // preventing the UI from waiting on a slow network or jumping around unnecessarily.
      setCatalog((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, available: !i.available } : i))
      );
      try {
        await menuService.toggleAvailability(item.id);
        toast.success(`"${item.name}" marked as ${item.available ? 'unavailable' : 'available'}`);
        // Ensure catalog matches server state perfectly
        await refreshCatalog();
      } catch {
        // Rollback optimistic update on error
        await refreshCatalog();
        toast.error('Failed to update availability');
      }
    },
    [refreshCatalog]
  );
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
        <div className="min-w-0">
          <p className="text-sm text-erp-secondary">
            {loading ? (
              'Loading menu from server…'
            ) : (
              <>
                {catalog.length} items · {availableCount} available
                {unavailableCount > 0 && (
                  <span className="text-red-600 font-medium">
                    {' '}
                    · {unavailableCount} unavailable
                  </span>
                )}
                {' · '}
                {totalCategories} categories
              </>
            )}
          </p>
        </div>
        {canMutate && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold text-xs sm:text-sm transition-colors shadow-sm shadow-amber-200 shrink-0"
          >
            <Plus size={16} />
            Add New Item
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full min-w-0 sm:w-auto sm:flex-1 sm:max-w-md">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search products by name or category"
            placeholder="Search name or category…"
            className="w-full pl-11 pr-11 py-2.5 rounded-xl border border-slate-200 bg-white shadow-sm text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <div
          role="group"
          aria-label="Product view"
          className="flex shrink-0 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 sm:ml-auto"
        >
          <button
            type="button"
            aria-pressed={viewMode === 'table'}
            onClick={() => setViewMode('table')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <List size={15} /> Table
          </button>
          <button
            type="button"
            aria-pressed={viewMode === 'grid'}
            onClick={() => setViewMode('grid')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <LayoutGrid size={15} /> Grid
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory('All')}
          aria-pressed={selectedCategory === 'All'}
          className={`shrink-0 px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
            selectedCategory === 'All'
              ? 'bg-amber-400 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
          }`}
        >
          All
          <span className="ml-1.5 text-xs opacity-70">({categoryCounts['All']})</span>
        </button>
        {ALL_CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat;
          const style = CATEGORY_STYLES[cat];
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              aria-pressed={selectedCategory === cat}
              className={`shrink-0 px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                isActive
                  ? `${style.badge} border border-current/20 shadow-sm`
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {cat}
              {categoryCounts[cat] > 0 && (
                <span className="ml-1.5 text-xs opacity-70">({categoryCounts[cat]})</span>
              )}
            </button>
          );
        })}
        <button
          onClick={() => setSelectedCategory('Unavailable')}
          aria-pressed={selectedCategory === 'Unavailable'}
          className={`shrink-0 px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
            selectedCategory === 'Unavailable'
              ? `${UNAVAILABLE_FILTER_STYLE.badge} shadow-sm`
              : 'bg-white border border-slate-200 text-slate-600 hover:border-red-200 hover:text-red-600'
          }`}
        >
          Unavailable
          {categoryCounts.Unavailable > 0 && (
            <span className="ml-1.5 text-xs opacity-70">({categoryCounts.Unavailable})</span>
          )}
        </button>
      </div>
      {(searchQuery || selectedCategory !== 'All') && (
        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 flex-wrap">
          <ListFilter size={14} className="shrink-0" />
          <span>
            Showing {filtered.length} item{filtered.length !== 1 ? 's' : ''}
            {selectedCategory === 'Unavailable' && (
              <span className="text-red-600 font-medium"> (unavailable only)</span>
            )}
          </span>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
            }}
            className="ml-1 text-amber-600 hover:text-amber-700 font-medium"
          >
            Clear filters
          </button>
        </div>
      )}
      {loading ? (
        <div
          role="status"
          className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500"
        >
          Loading products…
        </div>
      ) : filtered.length > 0 ? (
        viewMode === 'table' ? (
          <ProductTable
            items={filtered}
            onEdit={setEditingItem}
            onDelete={setDeletingItem}
            onToggle={handleToggle}
            readOnly={!canMutate}
          />
        ) : (
          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {filtered.map((item) => (
              <ProductCard
                key={item.id}
                item={item}
                onEdit={setEditingItem}
                onDelete={setDeletingItem}
                onToggle={handleToggle}
                readOnly={!canMutate}
              />
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4">
          <Package size={44} className="text-slate-300 mb-4" />
          <p className="text-base sm:text-lg font-semibold text-slate-500">No items found</p>
          <p className="text-sm text-slate-400 mt-1">
            {searchQuery
              ? `No results for "${searchQuery}"`
              : selectedCategory === 'Unavailable'
                ? 'No unavailable items — all products are available for order'
                : 'No items in this category yet'}
          </p>
          {canMutate && (
            <button
              onClick={() => {
                setShowAddModal(true);
                setSearchQuery('');
                setSelectedCategory('All');
              }}
              className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              Add First Item
            </button>
          )}
        </div>
      )}
      {showAddModal && <ItemFormModal onSave={handleAdd} onClose={() => setShowAddModal(false)} />}
      {editingItem && (
        <ItemFormModal
          item={editingItem}
          onSave={handleEdit}
          onClose={() => setEditingItem(null)}
        />
      )}
      {deletingItem && (
        <DeleteConfirmModal
          item={deletingItem}
          onConfirm={handleDelete}
          onCancel={() => setDeletingItem(null)}
        />
      )}
    </div>
  );
}
