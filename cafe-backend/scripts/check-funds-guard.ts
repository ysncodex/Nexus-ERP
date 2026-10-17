/**
 * READ-ONLY verification of the insufficient-funds guard.
 * Only reads balances and calls the guard; never writes a transaction.
 *
 * Usage: npx tsx scripts/check-funds-guard.ts
 */
import { prisma } from '../src/lib/prisma.js';
import {
  assertSufficientFunds,
  getAvailableBalance,
} from '../src/modules/funds/funds.service.js';
import type { FundAccountType } from '../src/generated/prisma/enums.js';

const ACCOUNTS: FundAccountType[] = ['cash', 'bank', 'bkash', 'reserve'];

async function expect(label: string, fn: () => Promise<unknown>, shouldThrow: boolean) {
  try {
    await fn();
    console.log(`${shouldThrow ? 'FAIL' : 'PASS'}  ${label}${shouldThrow ? ' (expected rejection)' : ''}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`${shouldThrow ? 'PASS' : 'FAIL'}  ${label}`);
    if (shouldThrow) console.log(`        -> ${message}`);
  }
}

async function main() {
  for (const account of ACCOUNTS) {
    const { available, label } = await getAvailableBalance(account);
    console.log(`${account.padEnd(8)} ${label.padEnd(14)} available=${available.toFixed(2)}`);
  }

  console.log('\n--- guard behaviour ---');
  const { available } = await getAvailableBalance('cash');

  await expect('zero amount is ignored', () => assertSufficientFunds('cash', 0), false);
  await expect(
    'affordable amount passes (1.00)',
    () => assertSufficientFunds('cash', 1),
    false,
  );
  await expect(
    'exact balance passes (boundary)',
    () => assertSufficientFunds('cash', available),
    false,
  );
  await expect(
    'one paisa over balance is rejected',
    () => assertSufficientFunds('cash', Math.round((available + 0.01) * 100) / 100),
    true,
  );
  await expect(
    'absurd amount is rejected',
    () => assertSufficientFunds('bkash', 99_999_999),
    true,
  );
  await expect(
    'reserve transfer over balance is rejected',
    () => assertSufficientFunds('reserve', 99_999_999),
    true,
  );
}

main()
  .catch((e) => {
    console.error('check failed:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
