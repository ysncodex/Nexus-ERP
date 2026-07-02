import type { Transaction } from '@/core/types';
import { salesService, expensesService } from '@/core/api/services';
import {
  parseApiTransaction,
  isSaleType,
  isExpenseType,
  transactionToSaleCreate,
  transactionToSaleUpdate,
  transactionToExpenseCreate,
  transactionToExpenseUpdate,
} from './apiSync';

/** Load all ledger rows from the backend (sales + expenses). */
export async function fetchAllTransactions(): Promise<Transaction[]> {
  const [sales, expenses] = await Promise.all([
    salesService.getAll(),
    expensesService.getAll(),
  ]);

  return [...sales, ...expenses].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

export async function createTransactionOnServer(
  data: Omit<Transaction, 'id' | 'date'> & { date?: Date },
): Promise<Transaction> {
  if (isSaleType(data.type)) {
    const saved = await salesService.create(transactionToSaleCreate(data));
    return parseApiTransaction(saved);
  }
  if (isExpenseType(data.type)) {
    const saved = await expensesService.create(transactionToExpenseCreate(data));
    return parseApiTransaction(saved);
  }
  throw new Error(`Unsupported transaction type: ${data.type}`);
}

export async function updateTransactionOnServer(tx: Transaction): Promise<Transaction> {
  if (isSaleType(tx.type)) {
    const saved = await salesService.update(tx.id, transactionToSaleUpdate(tx));
    return parseApiTransaction(saved);
  }
  if (isExpenseType(tx.type)) {
    const saved = await expensesService.update(tx.id, transactionToExpenseUpdate(tx));
    return parseApiTransaction(saved);
  }
  throw new Error(`Unsupported transaction type: ${tx.type}`);
}

export async function deleteTransactionOnServer(id: string, type: string): Promise<void> {
  if (isSaleType(type)) {
    await salesService.delete(id);
    return;
  }
  if (isExpenseType(type)) {
    await expensesService.delete(id);
    return;
  }
  throw new Error(`Unsupported transaction type: ${type}`);
}
