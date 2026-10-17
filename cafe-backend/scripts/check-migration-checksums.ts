/**
 * READ-ONLY. Compares the checksum recorded in _prisma_migrations against the
 * current on-disk migration.sql, so we can detect a migration that was edited
 * after being applied (which makes `prisma migrate deploy` fail).
 *
 * Usage: npx tsx scripts/check-migration-checksums.ts
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { prisma } from '../src/lib/prisma.js';

const MIGRATIONS_DIR = join(process.cwd(), 'prisma', 'migrations');

async function main() {
  const rows = await prisma.$queryRaw<{ migration_name: string; checksum: string }[]>`
    SELECT migration_name, checksum FROM _prisma_migrations ORDER BY started_at;
  `;

  let mismatched = 0;
  for (const row of rows) {
    const file = join(MIGRATIONS_DIR, row.migration_name, 'migration.sql');
    if (!existsSync(file)) {
      console.log(`MISSING-FILE  ${row.migration_name}`);
      continue;
    }
    const raw = readFileSync(file);
    const sha = (buf: Buffer | string) => createHash('sha256').update(buf).digest('hex');
    const asLf = raw.toString('utf8').replace(/\r\n/g, '\n');
    const asCrLf = asLf.replace(/\n/g, '\r\n');

    let how = '';
    if (sha(raw) === row.checksum) how = 'raw';
    else if (sha(asLf) === row.checksum) how = 'LF-normalized';
    else if (sha(asCrLf) === row.checksum) how = 'CRLF-normalized';

    if (!how) mismatched++;
    console.log(
      `${how ? 'OK       ' : 'MISMATCH '} ${row.migration_name}${how && how !== 'raw' ? `  (matches as ${how})` : ''}`,
    );
  }
  console.log(`\n${mismatched} mismatched migration file(s).`);
  if (mismatched > 0) {
    console.log('`prisma migrate deploy` will refuse to run until these match again.');
  }
}

main()
  .catch((e) => {
    console.error('check failed:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
