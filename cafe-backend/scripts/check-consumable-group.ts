/**
 * READ-ONLY-ish verification of the call that was breaking consumable saves.
 * `ensureConsumableGroup` is find-or-create; this only passes names that are
 * already seeded, so it resolves existing rows and writes nothing.
 *
 * Usage: npx tsx scripts/check-consumable-group.ts
 */
import { prisma } from '../src/lib/prisma.js';
import {
  ensureConsumableGroup,
  listConsumableGroups,
} from '../src/modules/expenses/catalog.service.js';

async function main() {
  const before = await listConsumableGroups();
  console.log(`groups in catalog (${before.length}): ${before.map((g) => g.name).join(', ')}`);

  // These are seeded by the migration, so ensure* takes the "found" path.
  for (const name of ['Cups', 'cups', '  Other  ']) {
    const row = await ensureConsumableGroup(name);
    console.log(`ensureConsumableGroup(${JSON.stringify(name)}) -> id=${row.id} name=${row.name}`);
  }

  const after = await listConsumableGroups();
  console.log(
    after.length === before.length
      ? `PASS  no rows created (still ${after.length})`
      : `NOTE  row count changed ${before.length} -> ${after.length}`,
  );
}

main()
  .catch((e) => {
    console.error('check failed:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
