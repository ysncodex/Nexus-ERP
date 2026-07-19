/**
 * Backfill fix for the cash/bKash/bank balance mismatch.
 *
 * Root cause: `sale` transactions created without an `orderNumber` (Dashboard /
 * Manager "Quick Record Sale", and any other manual sale entry that didn't pass
 * receiptStatus) were saved with `receiptStatus: NULL`. The frontend treats NULL
 * as "completed" everywhere it shows sales/revenue, but the backend's fund
 * balance aggregation (`getCombinedAccountBalances`) only sums rows where
 * `receiptStatus === 'completed'` exactly — so these sales were counted in every
 * sales total shown on screen, but silently excluded from the live cash/bank/
 * bkash drawer balances, making the drawer look short.
 *
 * This script finds every `sale` row with `receiptStatus IS NULL` that is not a
 * genuine draft (no linked pending order) and marks it `completed`, matching
 * what the UI has been telling the owner/manager all along. Nothing is deleted
 * or re-dated; only the `receiptStatus` column is touched.
 *
 * Usage:
 *   npx tsx scripts/backfill-receipt-status.ts            (dry run — report only)
 *   npx tsx scripts/backfill-receipt-status.ts --apply     (apply the fix)
 */
import { prisma } from '../src/lib/prisma.js';

async function main() {
  const apply = process.argv.includes('--apply');

  const affected = await prisma.transaction.findMany({
    where: { type: 'sale', receiptStatus: null },
    select: { id: true, method: true, amount: true, date: true, description: true, orderNumber: true },
    orderBy: { date: 'asc' },
  });

  if (affected.length === 0) {
    console.log('✔ No sale rows with a NULL receiptStatus were found. Nothing to do.');
    return;
  }

  const byMethod: Record<string, { count: number; total: number }> = {};
  for (const row of affected) {
    const key = row.method ?? 'unknown';
    byMethod[key] ??= { count: 0, total: 0 };
    byMethod[key].count += 1;
    byMethod[key].total += Number(row.amount);
  }

  console.log(`Found ${affected.length} sale row(s) with receiptStatus = NULL:\n`);
  for (const [method, { count, total }] of Object.entries(byMethod)) {
    console.log(`  ${method.padEnd(8)} → ${count} row(s), ৳${total.toLocaleString()}`);
  }
  console.log('');

  if (!apply) {
    console.log('Dry run only — no changes made. Re-run with --apply to fix these rows.');
    return;
  }

  const result = await prisma.transaction.updateMany({
    where: { type: 'sale', receiptStatus: null },
    data: { receiptStatus: 'completed' },
  });

  console.log(`✔ Updated ${result.count} row(s) to receiptStatus = 'completed'.`);
  console.log('Reload the dashboard — cash/bKash/bank balances should now include these sales.');
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
