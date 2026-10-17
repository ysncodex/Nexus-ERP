/**
 * READ-ONLY schema inspection helper. Does not mutate data.
 * Usage: npx tsx scripts/inspect-schema.ts
 */
import { prisma } from '../src/lib/prisma.js';

const TABLES = [
  'consumable_groups',
  'consumable_cost_records',
  'consumable_items',
  'staff_members',
  'staff_shifts',
  'payroll_records',
  'payroll_payments',
  'fund_accounts',
  'transactions',
];

async function main() {
  const tables = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name;
  `;
  const present = new Set(tables.map((t) => t.table_name));
  console.log('--- table presence ---');
  for (const t of TABLES) console.log(`${present.has(t) ? 'OK  ' : 'MISS'}  ${t}`);

  const cols = await prisma.$queryRaw<
    { table_name: string; column_name: string; data_type: string }[]
  >`
    SELECT table_name, column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('consumable_cost_records','fund_accounts')
    ORDER BY table_name, ordinal_position;
  `;
  console.log('\n--- consumable_cost_records / fund_accounts columns ---');
  for (const c of cols) console.log(`${c.table_name}.${c.column_name} : ${c.data_type}`);

  const txCols = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='transactions' ORDER BY ordinal_position;
  `;
  console.log('\n--- transactions columns ---');
  console.log(txCols.map((c) => c.column_name).join(', '));

  const migrations = await prisma.$queryRaw<
    { migration_name: string; finished_at: Date | null; applied_steps_count: number }[]
  >`
    SELECT migration_name, finished_at, applied_steps_count
    FROM _prisma_migrations ORDER BY started_at;
  `;
  console.log('\n--- applied migrations ---');
  for (const m of migrations) {
    console.log(
      `${String(m.applied_steps_count).padStart(2)} steps | ${m.finished_at ? 'done' : 'PENDING/FAILED'} | ${m.migration_name}`,
    );
  }

  const groups = present.has('consumable_groups')
    ? await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint FROM consumable_groups;`
    : null;
  if (groups) console.log(`\nconsumable_groups row count: ${groups[0].count}`);
}

main()
  .catch((e) => {
    console.error('inspect failed:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
