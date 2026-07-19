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

/**
 * Rows per page when loading the ledger. The backend caps `take` at 5000, so
 * anything ≤ 5000 is honoured; we page through until a short page is returned.
 */
const LEDGER_PAGE_SIZE = 1000;
/** Safety ceiling so a bad response can never spin an unbounded fetch loop. */
const MAX_LEDGER_PAGES = 200;

/**
 * Fetch every page of a paginated list endpoint and concatenate the results.
 *
 * The backend defaults `/sales` to only the 200 most-recent rows (and `/expenses`
 * to 1000) when no page/limit is supplied. That truncation makes client-side
 * totals, costings, and per-method breakdowns understate reality for busy shops,
 * which in turn disagrees with the authoritative server balances. Paging through
 * the full ledger keeps every derived figure complete and self-consistent.
 */
async function fetchAllPages(
  fetchPage: (page: number, limit: number) => Promise<Transaction[]>,
): Promise<Transaction[]> {
  const all: Transaction[] = [];
  for (let page = 1; page <= MAX_LEDGER_PAGES; page += 1) {
    const rows = await fetchPage(page, LEDGER_PAGE_SIZE);
    all.push(...rows);
    if (rows.length < LEDGER_PAGE_SIZE) break;
  }
  return all;
}

/** Load the complete ledger from the backend (all sales + all expenses). */
export async function fetchAllTransactions(): Promise<Transaction[]> {
  const [sales, expenses] = await Promise.all([
    fetchAllPages((page, limit) => salesService.getAll({ page, limit })),
    fetchAllPages((page, limit) => expensesService.getAll({ page, limit })),
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
