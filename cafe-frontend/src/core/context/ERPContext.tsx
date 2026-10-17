import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import type {
  Transaction,
  DateRange,
  DateRangeFilter,
  ERPContextType,
  CatalogItem,
  Supplier,
  FundMovement,
  FundBalances,
} from '@/core/types';
import { generateId, STORAGE_KEYS, blockReadOnlyMutation, isAuthenticated } from '@/shared/utils';
import { businessTodayDateRange, todayBusinessKey } from '@/shared/utils/businessDate';
import { isLedgerExpense } from '@/core/types/transaction.types';

import { savePersistedERPState } from './erp/storage';
import { normalizeLabel } from './erp/listUtils';
import { filterTransactions } from './erp/filters';
import { computeStats } from './erp/stats';
import { computeDailyRecords } from './erp/dailyRecords';
import {
  createTransactionOnServer,
  deleteTransactionOnServer,
  fetchAllTransactions,
  updateTransactionOnServer,
} from './erp/apiRepository';
import { catalogService, suppliersService, fundsService } from '@/core/api/services';

import { ERPContext } from './ERPContextDef';
import { ERPActionsContext, type ERPActions } from './ERPActionsContextDef';

/** Drop saved calendar ranges when the business day rolls over (Asia/Dhaka). */
function syncBusinessDayStorage(): void {
  if (typeof window === 'undefined') return;
  const today = todayBusinessKey();
  const last = localStorage.getItem(STORAGE_KEYS.ERP_BUSINESS_DAY);
  if (last !== today) {
    localStorage.removeItem(STORAGE_KEYS.DATE_RANGE);
    localStorage.setItem(STORAGE_KEYS.ERP_BUSINESS_DAY, today);
  }
}

function loadSavedDateRange(): DateRangeFilter {
  if (typeof window === 'undefined') return businessTodayDateRange();
  syncBusinessDayStorage();
  // Always open on today's business day; use the calendar when history is needed.
  return businessTodayDateRange();
}

/** Legacy localStorage bootstrap — catalogs now load from the API. */
export function ERPProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [fundMovements, setFundMovements] = useState<FundMovement[]>([]);
  const [fundBalances, setFundBalances] = useState<FundBalances | null>(null);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [customDateRange, setCustomDateRangeState] = useState<DateRangeFilter>(loadSavedDateRange);

  const setCustomDateRange = useCallback((range: DateRangeFilter) => {
    setCustomDateRangeState(range.from && range.to ? range : businessTodayDateRange());
  }, []);

  const [fixedCostItems, setFixedCostItems] = useState<CatalogItem[]>([]);
  const [productCostItems, setProductCostItems] = useState<CatalogItem[]>([]);
  const [consumableGroups, setConsumableGroups] = useState<CatalogItem[]>([]);
  const [consumableItems, setConsumableItems] = useState<CatalogItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const refreshCatalogs = useCallback(async () => {
    if (!isAuthenticated()) {
      setFixedCostItems([]);
      setProductCostItems([]);
      setConsumableGroups([]);
      setConsumableItems([]);
      setSuppliers([]);
      return;
    }

    try {
      const [fixedItems, productItems, supplierRows, consumableGroupRows, consumableRows] =
        await Promise.all([
          catalogService.getFixedItems(),
          catalogService.getProductItems(),
          suppliersService.getAll(),
          // These two 404 before the Consumables & Packaging migration is
          // deployed; swallow so the rest of the catalogs still load.
          catalogService.getConsumableGroups().catch(() => [] as CatalogItem[]),
          catalogService.getConsumableItems().catch(() => [] as CatalogItem[]),
        ]);
      setFixedCostItems(fixedItems);
      setProductCostItems(productItems);
      setConsumableGroups(consumableGroupRows);
      setConsumableItems(consumableRows);
      setSuppliers(supplierRows);
    } catch {
      toast.error('Could not load expense catalogs from server');
    }
  }, []);

  const refreshFundMovements = useCallback(async () => {
    if (!isAuthenticated()) {
      setFundMovements([]);
      return;
    }

    try {
      const rows = await fundsService.getAll();
      setFundMovements(rows);
    } catch {
      toast.error('Could not load fund movements from server');
      setFundMovements([]);
    }
  }, []);

  // Authoritative account balances (server aggregates the full ledger, so these
  // are correct even though the client only caches a recent window of rows).
  const refreshFundBalances = useCallback(async () => {
    if (!isAuthenticated()) {
      setFundBalances(null);
      return;
    }

    try {
      setFundBalances(await fundsService.getBalances());
    } catch {
      // Non-fatal: stats gracefully fall back to client-derived balances.
      setFundBalances(null);
    }
  }, []);

  const refreshTransactions = useCallback(async (opts?: { silent?: boolean }) => {
    if (!isAuthenticated()) {
      setTransactions([]);
      setIsLoadingTransactions(false);
      return;
    }

    if (!opts?.silent) setIsLoadingTransactions(true);
    try {
      const rows = await fetchAllTransactions();
      setTransactions(rows);
      // Sales/expenses change cash/bank/bKash drawer totals — keep the
      // authoritative balances in lockstep so Manager Dashboard doesn't
      // require a full page reload after an order.
      void refreshFundBalances();
    } catch {
      toast.error('Could not load transactions from server');
      setTransactions([]);
    } finally {
      if (!opts?.silent) setIsLoadingTransactions(false);
    }
  }, [refreshFundBalances]);

  // Legacy localStorage hook — no longer persists catalog names
  useEffect(() => {
    savePersistedERPState(STORAGE_KEYS.ERP_STATE, {
      transactions: [],
      itemNames: [],
      suppliers: [],
    });
  }, []);

  // ── Load ledger from backend on mount ───────────────────────────────────────
  useEffect(() => {
    void refreshTransactions();
    void refreshCatalogs();
    void refreshFundMovements();
  }, [refreshTransactions, refreshCatalogs, refreshFundMovements]);

  // ── Derived state ───────────────────────────────────────────────────────────
  const filteredTransactions = useMemo(
    () => filterTransactions({ transactions, dateRange, customStart, customEnd, customDateRange }),
    [transactions, dateRange, customStart, customEnd, customDateRange]
  );

  const authoritativeBalances = useMemo(
    () =>
      fundBalances
        ? {
            cash: fundBalances.combined.cash,
            bank: fundBalances.combined.bank,
            bkash: fundBalances.combined.bkash,
            reserve: fundBalances.combined.reserve,
            totalLiquidity: fundBalances.totalLiquidity,
          }
        : undefined,
    [fundBalances]
  );

  const stats = useMemo(
    () => computeStats(transactions, filteredTransactions, fundMovements, authoritativeBalances),
    [transactions, filteredTransactions, fundMovements, authoritativeBalances]
  );

  const dailyRecords = useMemo(
    () => computeDailyRecords(filteredTransactions),
    [filteredTransactions]
  );

  // ── Transaction actions (optimistic UI + API sync) ──────────────────────────

  const addTransaction = useCallback(
    (data: Omit<Transaction, 'id' | 'date'> & { date?: Date }): Transaction => {
      if (blockReadOnlyMutation()) {
        return { ...data, id: 'blocked', date: data.date ?? new Date() } as Transaction;
      }

      const optimistic: Transaction = {
        ...data,
        id: `temp-${generateId()}`,
        date: data.date ?? new Date(),
      };

      setTransactions((prev) => [optimistic, ...prev]);

      void createTransactionOnServer(data)
        .then((saved) => {
          setTransactions((prev) => prev.map((t) => (t.id === optimistic.id ? saved : t)));
          if (isLedgerExpense(saved.type)) {
            void refreshCatalogs();
          }
          void refreshFundBalances();
        })
        .catch((error: unknown) => {
          setTransactions((prev) => prev.filter((t) => t.id !== optimistic.id));
          // Surface the server's reason (e.g. insufficient funds) instead of a
          // generic failure, so the user knows what to change.
          const serverMessage = isAxiosError<{ message?: string }>(error)
            ? error.response?.data?.message
            : undefined;
          toast.error(serverMessage || 'Failed to save transaction');
        });

      return optimistic;
    },
    [refreshCatalogs, refreshFundBalances]
  );

  const deleteTransaction = useCallback(async (id: string) => {
    if (blockReadOnlyMutation()) return;

    // Read the row from the latest state inside the updater so this callback
    // stays referentially stable (empty deps) and doesn't churn the context value.
    let existing: Transaction | undefined;
    setTransactions((prev) => {
      existing = prev.find((t) => t.id === id);
      return existing ? prev.filter((t) => t.id !== id) : prev;
    });
    if (!existing) return;

    try {
      await deleteTransactionOnServer(id, existing.type);
      void refreshFundBalances();
    } catch (error) {
      const restored = existing;
      setTransactions((prev) => [restored, ...prev.filter((t) => t.id !== id)]);
      throw error;
    }
  }, [refreshFundBalances]);

  const updateTransaction = useCallback((updated: Transaction) => {
    if (blockReadOnlyMutation()) return;

    setTransactions((prev) => {
      const previous = prev.find((t) => t.id === updated.id);
      void updateTransactionOnServer(updated)
        .then((saved) => {
          setTransactions((p) => p.map((t) => (t.id === saved.id ? saved : t)));
          void refreshFundBalances();
        })
        .catch((error: unknown) => {
          if (previous) {
            setTransactions((p) => p.map((t) => (t.id === previous.id ? previous : t)));
          }
          const serverMessage = isAxiosError<{ message?: string }>(error)
            ? error.response?.data?.message
            : undefined;
          toast.error(serverMessage || 'Failed to update transaction');
        });
      return prev.map((t) => (t.id === updated.id ? updated : t));
    });
  }, [refreshFundBalances]);

  const clearAllData = useCallback(() => {
    if (blockReadOnlyMutation()) return;
    setTransactions([]);
    toast.message('Local transaction cache cleared — refresh to reload from server.');
  }, []);

  const findFixedByName = useCallback(
    (name: string) => fixedCostItems.find((i) => i.name.toLowerCase() === name.toLowerCase()),
    [fixedCostItems]
  );
  const findProductByName = useCallback(
    (name: string) => productCostItems.find((i) => i.name.toLowerCase() === name.toLowerCase()),
    [productCostItems]
  );
  const findConsumableByName = useCallback(
    (name: string) => consumableItems.find((i) => i.name.toLowerCase() === name.toLowerCase()),
    [consumableItems]
  );
  const findConsumableGroupByName = useCallback(
    (name: string) => consumableGroups.find((g) => g.name.toLowerCase() === name.toLowerCase()),
    [consumableGroups]
  );
  const findSupplierByName = useCallback(
    (name: string) => suppliers.find((s) => s.name.toLowerCase() === name.toLowerCase()),
    [suppliers]
  );

  const addFixedCostItem = useCallback(
    async (name: string) => {
      if (blockReadOnlyMutation()) return;
      const v = normalizeLabel(name);
      if (!v) return;
      await catalogService.createFixedItem(v);
      await refreshCatalogs();
    },
    [refreshCatalogs]
  );

  const addConsumableGroup = useCallback(
    async (name: string) => {
      if (blockReadOnlyMutation()) return;
      const v = normalizeLabel(name);
      if (!v) return;
      await catalogService.createConsumableGroup(v);
      await refreshCatalogs();
    },
    [refreshCatalogs]
  );

  const addConsumableItem = useCallback(
    async (name: string) => {
      if (blockReadOnlyMutation()) return;
      const v = normalizeLabel(name);
      if (!v) return;
      await catalogService.createConsumableItem(v);
      await refreshCatalogs();
    },
    [refreshCatalogs]
  );

  const addProductCostItem = useCallback(
    async (name: string) => {
      if (blockReadOnlyMutation()) return;
      const v = normalizeLabel(name);
      if (!v) return;
      await catalogService.createProductItem(v);
      await refreshCatalogs();
    },
    [refreshCatalogs]
  );

  const addSupplier = useCallback(
    async (data: import('@/core/api/services').SupplierCreateData) => {
      if (blockReadOnlyMutation()) return;
      const name = normalizeLabel(data.name);
      const phone = data.phone?.trim();
      const address = data.address?.trim();
      if (!name || !phone || !address) {
        throw new Error('Name, contact, and address are required');
      }
      await suppliersService.create({
        name,
        phone,
        address,
        email: data.email?.trim() || undefined,
        notes: data.notes?.trim() || undefined,
      });
      await refreshCatalogs();
    },
    [refreshCatalogs]
  );

  const renameFixedCostItem = useCallback(
    async (oldName: string, newName: string) => {
      if (blockReadOnlyMutation()) return;
      const item = findFixedByName(oldName);
      const v = normalizeLabel(newName);
      if (!item || !v) return;
      await catalogService.renameFixedItem(item.id, v);
      await refreshCatalogs();
    },
    [findFixedByName, refreshCatalogs]
  );

  const renameConsumableGroup = useCallback(
    async (oldName: string, newName: string) => {
      if (blockReadOnlyMutation()) return;
      const group = findConsumableGroupByName(oldName);
      const v = normalizeLabel(newName);
      if (!group || !v) return;
      await catalogService.renameConsumableGroup(group.id, v);
      // The server already rewrote every matching ledger row. Patch the rows
      // we have instead of re-downloading the whole ledger — that refetch was
      // what made a rename feel slow.
      setConsumableGroups((prev) =>
        prev.map((item) => (item.id === group.id ? { ...item, name: v } : item)),
      );
      setTransactions((prev) =>
        prev.map((row) =>
          row.type === 'expense_consumable' && row.category === group.name
            ? { ...row, category: v }
            : row,
        ),
      );
    },
    [findConsumableGroupByName]
  );

  const renameConsumableItem = useCallback(
    async (oldName: string, newName: string) => {
      if (blockReadOnlyMutation()) return;
      const item = findConsumableByName(oldName);
      const v = normalizeLabel(newName);
      if (!item || !v) return;
      await catalogService.renameConsumableItem(item.id, v);
      await refreshCatalogs();
    },
    [findConsumableByName, refreshCatalogs]
  );

  const renameProductCostItem = useCallback(
    async (oldName: string, newName: string) => {
      if (blockReadOnlyMutation()) return;
      const item = findProductByName(oldName);
      const v = normalizeLabel(newName);
      if (!item || !v) return;
      await catalogService.renameProductItem(item.id, v);
      await refreshCatalogs();
    },
    [findProductByName, refreshCatalogs]
  );

  const renameSupplier = useCallback(
    async (oldName: string, newName: string) => {
      if (blockReadOnlyMutation()) return;
      const row = findSupplierByName(oldName);
      const v = normalizeLabel(newName);
      if (!row || !v) return;
      await suppliersService.update(row.id, { name: v });
      await refreshCatalogs();
    },
    [findSupplierByName, refreshCatalogs]
  );

  const deleteFixedCostItem = useCallback(
    async (name: string) => {
      if (blockReadOnlyMutation()) return;
      const item = findFixedByName(name);
      if (!item) return;
      await catalogService.deleteFixedItem(item.id);
      await refreshCatalogs();
    },
    [findFixedByName, refreshCatalogs]
  );

  const deleteConsumableGroup = useCallback(
    async (name: string) => {
      if (blockReadOnlyMutation()) return;
      const group = findConsumableGroupByName(name);
      if (!group) return;
      await catalogService.deleteConsumableGroup(group.id);
      // Past purchases keep the name stored on each row. Only the picker list changes.
      setConsumableGroups((prev) => prev.filter((item) => item.id !== group.id));
    },
    [findConsumableGroupByName]
  );

  const deleteConsumableItem = useCallback(
    async (name: string) => {
      if (blockReadOnlyMutation()) return;
      const item = findConsumableByName(name);
      if (!item) return;
      await catalogService.deleteConsumableItem(item.id);
      await refreshCatalogs();
    },
    [findConsumableByName, refreshCatalogs]
  );

  const deleteProductCostItem = useCallback(
    async (name: string) => {
      if (blockReadOnlyMutation()) return;
      const item = findProductByName(name);
      if (!item) return;
      await catalogService.deleteProductItem(item.id);
      await refreshCatalogs();
    },
    [findProductByName, refreshCatalogs]
  );

  const deleteSupplier = useCallback(
    async (name: string) => {
      if (blockReadOnlyMutation()) return;
      const row = findSupplierByName(name);
      if (!row) return;
      await suppliersService.delete(row.id);
      await refreshCatalogs();
    },
    [findSupplierByName, refreshCatalogs]
  );

  /** Legacy alias — product cost item names for older modals */
  const itemNames = useMemo(() => productCostItems.map((i) => i.name), [productCostItems]);

  const addItemName = useCallback(
    (name: string) => {
      void addProductCostItem(name);
    },
    [addProductCostItem]
  );

  const renameItemName = useCallback(
    (oldName: string, newName: string) => {
      void renameProductCostItem(oldName, newName);
    },
    [renameProductCostItem]
  );

  const deleteItemName = useCallback(
    (name: string) => {
      void deleteProductCostItem(name);
    },
    [deleteProductCostItem]
  );

  // Memoize the context value so consumers only re-render when data they use
  // actually changes — not on every provider render. All callbacks below are
  // referentially stable (useCallback), so the deps are effectively the state.
  const value = useMemo<ERPContextType>(
    () => ({
      transactions,
      filteredTransactions,
      addTransaction,
      deleteTransaction,
      updateTransaction,
      clearAllData,
      dateRange,
      setDateRange,
      customStart,
      setCustomStart,
      customEnd,
      setCustomEnd,
      customDateRange,
      setCustomDateRange,
      stats,
      dailyRecords,
      isLoadingTransactions,
      refreshTransactions,
      refreshCatalogs,
      fundMovements,
      refreshFundMovements,
      fundBalances,
      refreshFundBalances,
      fixedCostItems,
      productCostItems,
      consumableGroups,
      consumableItems,
      suppliers,
      itemNames,
      addFixedCostItem,
      renameFixedCostItem,
      deleteFixedCostItem,
      addProductCostItem,
      renameProductCostItem,
      deleteProductCostItem,
      addConsumableGroup,
      renameConsumableGroup,
      deleteConsumableGroup,
      addConsumableItem,
      renameConsumableItem,
      deleteConsumableItem,
      addItemName,
      renameItemName,
      deleteItemName,
      addSupplier,
      renameSupplier,
      deleteSupplier,
    }),
    [
      transactions,
      filteredTransactions,
      addTransaction,
      deleteTransaction,
      updateTransaction,
      clearAllData,
      dateRange,
      setDateRange,
      customStart,
      customEnd,
      customDateRange,
      setCustomDateRange,
      stats,
      dailyRecords,
      isLoadingTransactions,
      refreshTransactions,
      refreshCatalogs,
      fundMovements,
      refreshFundMovements,
      fundBalances,
      refreshFundBalances,
      fixedCostItems,
      productCostItems,
      consumableGroups,
      consumableItems,
      suppliers,
      itemNames,
      addFixedCostItem,
      renameFixedCostItem,
      deleteFixedCostItem,
      addProductCostItem,
      renameProductCostItem,
      deleteProductCostItem,
      addConsumableGroup,
      renameConsumableGroup,
      deleteConsumableGroup,
      addConsumableItem,
      renameConsumableItem,
      deleteConsumableItem,
      addItemName,
      renameItemName,
      deleteItemName,
      addSupplier,
      renameSupplier,
      deleteSupplier,
    ]
  );

  // Stable action-only surface. All entries are referentially stable, so this
  // value never changes after mount → `useERPActions()` consumers never re-render
  // on data changes.
  const actionsValue = useMemo<ERPActions>(
    () => ({
      addTransaction,
      deleteTransaction,
      updateTransaction,
      clearAllData,
      setDateRange,
      setCustomStart,
      setCustomEnd,
      setCustomDateRange,
      refreshTransactions,
      refreshCatalogs,
      refreshFundMovements,
      refreshFundBalances,
      addFixedCostItem,
      renameFixedCostItem,
      deleteFixedCostItem,
      addProductCostItem,
      renameProductCostItem,
      deleteProductCostItem,
      addConsumableGroup,
      renameConsumableGroup,
      deleteConsumableGroup,
      addConsumableItem,
      renameConsumableItem,
      deleteConsumableItem,
      addItemName,
      renameItemName,
      deleteItemName,
      addSupplier,
      renameSupplier,
      deleteSupplier,
    }),
    [
      addTransaction,
      deleteTransaction,
      updateTransaction,
      clearAllData,
      setCustomDateRange,
      refreshTransactions,
      refreshCatalogs,
      refreshFundMovements,
      refreshFundBalances,
      addFixedCostItem,
      renameFixedCostItem,
      deleteFixedCostItem,
      addProductCostItem,
      renameProductCostItem,
      deleteProductCostItem,
      addConsumableGroup,
      renameConsumableGroup,
      deleteConsumableGroup,
      addConsumableItem,
      renameConsumableItem,
      deleteConsumableItem,
      addItemName,
      renameItemName,
      deleteItemName,
      addSupplier,
      renameSupplier,
      deleteSupplier,
    ]
  );

  return (
    <ERPActionsContext.Provider value={actionsValue}>
      <ERPContext.Provider value={value}>{children}</ERPContext.Provider>
    </ERPActionsContext.Provider>
  );
}
