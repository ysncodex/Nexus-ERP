import { isPaidSale, type Transaction } from '@/core/types/transaction.types';
import { businessDateKey, todayBusinessKey } from '@/shared/utils/businessDate';

/**
 * Payment Method Balance Tracking
 * Comprehensive tracking for Cash, Bank, and Bkash balances
 */

export interface MethodBreakdown {
  balance: number;
  sales: number;
  expenses: number;
}

export interface PaymentMethodBalances {
  cash: MethodBreakdown;
  bank: MethodBreakdown;
  bkash: MethodBreakdown;
  total: {
    balance: number;
    sales: number;
    expenses: number;
  };
}

function emptyBreakdown(): MethodBreakdown {
  return { balance: 0, sales: 0, expenses: 0 };
}

/**
 * Calculate comprehensive balances for all payment methods
 */
export function calculatePaymentMethodBalances(
  allTransactions: Transaction[],
  filteredTransactions?: Transaction[]
): PaymentMethodBalances {
  const filtered = filteredTransactions || allTransactions;

  const cash = emptyBreakdown();
  const bank = emptyBreakdown();
  const bkash = emptyBreakdown();

  const applyBalance = (method: Transaction['method'], delta: number) => {
    if (method === 'cash') cash.balance += delta;
    else if (method === 'bank') bank.balance += delta;
    else if (method === 'bkash') bkash.balance += delta;
  };

  allTransactions.forEach((t) => {
    const val = Number(t.amount);
    const method = t.method;

    if (isPaidSale(t)) applyBalance(method, val);
    else if (t.type === 'sale_adjustment') applyBalance(method, -val);
    else if (t.type === 'expense_product' || t.type === 'expense_fixed') applyBalance(method, -val);
  });

  filtered.forEach((t) => {
    const val = Number(t.amount);
    const method = t.method;

    if (method === 'cash') {
      if (isPaidSale(t)) cash.sales += val;
      else if (t.type === 'sale_adjustment') cash.sales -= val;
      else if (t.type === 'expense_product' || t.type === 'expense_fixed') cash.expenses += val;
    } else if (method === 'bank') {
      if (isPaidSale(t)) bank.sales += val;
      else if (t.type === 'sale_adjustment') bank.sales -= val;
      else if (t.type === 'expense_product' || t.type === 'expense_fixed') bank.expenses += val;
    } else if (method === 'bkash') {
      if (isPaidSale(t)) bkash.sales += val;
      else if (t.type === 'sale_adjustment') bkash.sales -= val;
      else if (t.type === 'expense_product' || t.type === 'expense_fixed') bkash.expenses += val;
    }
  });

  return {
    cash,
    bank,
    bkash,
    total: {
      balance: cash.balance + bank.balance + bkash.balance,
      sales: cash.sales + bank.sales + bkash.sales,
      expenses: cash.expenses + bank.expenses + bkash.expenses,
    },
  };
}

/**
 * Calculate daily available cash (today only) — sales minus adjustments and expenses.
 */
export function calculateDailyAvailableCash(transactions: Transaction[]): number {
  const todayKey = todayBusinessKey();
  let dailyAvailableCash = 0;

  transactions.forEach((t) => {
    const val = Number(t.amount);
    if (businessDateKey(t.date) !== todayKey) return;

    if (isPaidSale(t)) dailyAvailableCash += val;
    else if (t.type === 'sale_adjustment') dailyAvailableCash -= val;
    else if (t.type === 'expense_product' || t.type === 'expense_fixed') dailyAvailableCash -= val;
  });

  return dailyAvailableCash;
}
