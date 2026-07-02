/**
 * Core Type Exports
 * Barrel file for all type definitions
 */

// Transaction types
export * from './transaction.types';

// Payment types
export * from './payment.types';

// Common types
export * from './common.types';
export * from './catalog.types';

// ERP Context types
export interface ERPContextType {
  // Transactions
  transactions: Transaction[];
  filteredTransactions: Transaction[];
  /** Adds a transaction and returns the fully-formed record (including generated id). */
  addTransaction: (t: Omit<Transaction, 'id' | 'date'> & { date?: Date }) => Transaction;
  deleteTransaction: (id: string) => void;
  updateTransaction: (t: Transaction) => void;
  /** Wipes local transaction cache and resets item/supplier lists. Server data is unchanged. */
  clearAllData: () => void;

  // Filters
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  customStart: string;
  setCustomStart: (date: string) => void;
  customEnd: string;
  setCustomEnd: (date: string) => void;
  customDateRange: DateRangeFilter;
  setCustomDateRange: (range: DateRangeFilter) => void;

  // Analytics
  stats: ERPStats;
  dailyRecords: DailyRecord[];

  /** True while the initial backend sync is in progress. */
  isLoadingTransactions: boolean;
  /** Re-fetch sales + expenses from the backend. */
  refreshTransactions: () => Promise<void>;

  /** Re-fetch fixed-cost names, product-cost names, and suppliers from the backend. */
  refreshCatalogs: () => Promise<void>;

  // Catalog lists (server-backed)
  fixedCostItems: CatalogItem[];
  productCostItems: CatalogItem[];
  suppliers: Supplier[];

  /** @deprecated Use fixedCostItems / productCostItems — kept for legacy modals */
  itemNames: string[];
  addItemName: (name: string) => void;
  renameItemName: (oldName: string, newName: string) => void;
  deleteItemName: (name: string) => void;

  addFixedCostItem: (name: string) => Promise<void>;
  renameFixedCostItem: (oldName: string, newName: string) => Promise<void>;
  deleteFixedCostItem: (name: string) => Promise<void>;

  addProductCostItem: (name: string) => Promise<void>;
  renameProductCostItem: (oldName: string, newName: string) => Promise<void>;
  deleteProductCostItem: (name: string) => Promise<void>;

  addSupplier: (data: import('@/core/api/services').SupplierCreateData) => Promise<void>;
  renameSupplier: (oldName: string, newName: string) => Promise<void>;
  deleteSupplier: (name: string) => Promise<void>;
}

// Stats interface
export interface ERPStats {
  totalSales: number;
  foodpandaSales: number;
  foodiSales: number;
  cashInHand: number;
  totalLiquidity: number;
  cashBalance: number;
  bankBalance: number;
  bkashBalance: number;
  totalBalance: number;
  cashSales: number;
  bankSales: number;
  bkashSales: number;
  bankReceived: number;
  bkashReceived: number;
  cashExpenses: number;
  bankExpenses: number;
  bkashExpenses: number;
  totalExpenses: number;
  totalProductCost: number;
  totalFixedCost: number;
  dailyAvailableCash: number;
  netCashInRange: number;
  profit: number;
  grossProfit: number;
  expenseCategories: Record<string, number>;
  productUsage: Record<string, { qty: number; unit: string; cost: number; count: number }>;
  recentSales: Array<{ name: string; value: number }>;
  topProducts: Array<{ name: string; cost: number; qty: number; unit: string }>;
  topFixed: Array<{ name: string; amount: number }>;
  paymentMethods: PaymentMethodBalances;
}

// Daily Record interface
export interface DailyRecord {
  date: Date;
  cashSales: number;
  bkashSales: number;
  bankSales: number;
  cashCosts: number;
  bankCosts: number;
  bkashCosts: number;
  dailyCosts: number;
  /** cashSales + bkashSales + bankSales */
  totalSales: number;
  /** Net cash flow for the day: totalSales − dailyCosts */
  dailyAvail: number;
}

// Re-export types for convenience
import type { Transaction } from './transaction.types';
import type { PaymentMethodBalances } from './payment.types';
import type { DateRange, DateRangeFilter } from './common.types';
import type { CatalogItem, Supplier } from './catalog.types';
