/**
 * READ-ONLY. Prints current combined account balances so we can judge whether
 * an insufficient-funds guard would immediately block legitimate expenses.
 * Usage: npx tsx scripts/inspect-balances.ts
 */
import { prisma } from '../src/lib/prisma.js';
import { getCombinedAccountBalances } from '../src/modules/funds/funds.service.js';

async function main() {
  const b = await getCombinedAccountBalances();
  console.log('--- combined balances ---');
  for (const a of b.accounts) {
    console.log(
      `${a.type.padEnd(8)} label=${a.label.padEnd(14)} operational=${a.operationalBalance
        .toFixed(2)
        .padStart(12)}  manualAdj=${a.fundAdjustment.toFixed(2).padStart(12)}  TOTAL=${a.balance
        .toFixed(2)
        .padStart(12)}`,
    );
  }
  console.log(`\ntotalLiquidity = ${b.totalLiquidity.toFixed(2)}`);

  const negative = b.accounts.filter((a) => a.balance < 0);
  console.log(
    negative.length
      ? `\nWARNING: ${negative.length} account(s) already negative: ${negative
          .map((a) => `${a.type}=${a.balance.toFixed(2)}`)
          .join(', ')}`
      : '\nAll accounts are non-negative.',
  );

  const txCount = await prisma.transaction.count();
  const consumables = await prisma.transaction.count({ where: { type: 'expense_consumable' } });
  console.log(`\ntransactions total=${txCount}, expense_consumable=${consumables}`);
}

main()
  .catch((e) => {
    console.error('inspect failed:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
