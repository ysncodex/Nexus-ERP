import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';
import { normalizeCatalogName } from '../../utils/normalizeName.js';

/** Neon’s pooler often needs longer than Prisma’s 2s default to hand out a connection. */
const NEON_TX = { maxWait: 15000, timeout: 20000 } as const;

export async function ensureFixedCostItem(name: string) {
  const normalized = normalizeCatalogName(name);
  const existing = await prisma.fixedCostItem.findFirst({
    where: { name: { equals: normalized, mode: 'insensitive' } },
  });
  if (existing) return existing;
  return prisma.fixedCostItem.create({ data: { name: normalized } });
}

export async function ensureConsumableItem(name: string) {
  const normalized = normalizeCatalogName(name);
  const existing = await prisma.consumableItem.findFirst({
    where: { name: { equals: normalized, mode: 'insensitive' } },
  });
  if (existing) return existing;
  return prisma.consumableItem.create({ data: { name: normalized } });
}

export async function ensureConsumableGroup(name: string) {
  const normalized = normalizeCatalogName(name);
  const existing = await prisma.consumableGroup.findFirst({
    where: { name: { equals: normalized, mode: 'insensitive' } },
  });
  if (existing) return existing;
  return prisma.consumableGroup.create({ data: { name: normalized } });
}

export async function ensureProductCostItem(name: string) {
  const normalized = normalizeCatalogName(name);
  const existing = await prisma.productCostItem.findFirst({
    where: { name: { equals: normalized, mode: 'insensitive' } },
  });
  if (existing) return existing;
  return prisma.productCostItem.create({ data: { name: normalized } });
}

export async function findSupplierByName(name: string) {
  const normalized = normalizeCatalogName(name);
  return prisma.supplier.findFirst({
    where: { name: { equals: normalized, mode: 'insensitive' } },
  });
}

export async function listFixedCostItems() {
  return prisma.fixedCostItem.findMany({ orderBy: { name: 'asc' } });
}

export async function listProductCostItems() {
  return prisma.productCostItem.findMany({ orderBy: { name: 'asc' } });
}

export async function listConsumableItems() {
  return prisma.consumableItem.findMany({ orderBy: { name: 'asc' } });
}

export async function listConsumableGroups() {
  return prisma.consumableGroup.findMany({ orderBy: { name: 'asc' } });
}

export async function renameFixedCostItem(id: string, name: string) {
  const normalized = normalizeCatalogName(name);
  return prisma.fixedCostItem.update({ where: { id }, data: { name: normalized } });
}

export async function renameConsumableItem(id: string, name: string) {
  const normalized = normalizeCatalogName(name);
  return prisma.consumableItem.update({ where: { id }, data: { name: normalized } });
}

/**
 * Rename a consumables group and keep every existing ledger row + detail row
 * aligned to the new label. Done in a transaction so the group name never
 * diverges from `transactions.category` / `consumable_cost_records.groupName`.
 */
export async function renameConsumableGroup(id: string, name: string) {
  const normalized = normalizeCatalogName(name);
  // Read outside the transaction so we don't hold a Neon connection while we
  // only need the previous label.
  const existing = await prisma.consumableGroup.findUnique({ where: { id } });
  if (!existing) {
    throw Object.assign(new Error('Consumable group not found'), { code: 'NOT_FOUND' });
  }
  if (existing.name === normalized) return existing;

  try {
    // One batched transaction: the catalog name and every historical row that
    // shows it change together. A sequential array is one round trip, which
    // starts far more reliably on Neon than an interactive callback.
    const [, , group] = await prisma.$transaction(
      [
        prisma.transaction.updateMany({
          where: { type: 'expense_consumable', category: existing.name },
          data: { category: normalized },
        }),
        prisma.consumableCostRecord.updateMany({
          where: { groupName: existing.name },
          data: { groupName: normalized },
        }),
        prisma.consumableGroup.update({
          where: { id },
          data: { name: normalized },
        }),
      ],
      NEON_TX,
    );
    return group;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw Object.assign(new Error('A group with that name already exists.'), {
        code: 'DUPLICATE',
      });
    }
    throw error;
  }
}

export async function renameProductCostItem(id: string, name: string) {
  const normalized = normalizeCatalogName(name);
  return prisma.productCostItem.update({ where: { id }, data: { name: normalized } });
}

export async function deleteFixedCostItem(id: string) {
  await prisma.fixedCostItem.delete({ where: { id } });
}

export async function deleteProductCostItem(id: string) {
  await prisma.productCostItem.delete({ where: { id } });
}

export async function deleteConsumableItem(id: string) {
  await prisma.consumableItem.delete({ where: { id } });
}

/**
 * Removes the group from the picker only. Recorded purchases keep the name
 * already stored on `transactions.category` and `consumable_cost_records.group_name`,
 * so reports and past rows do not change.
 */
export async function deleteConsumableGroup(id: string) {
  const existing = await prisma.consumableGroup.findUnique({ where: { id } });
  if (!existing) {
    throw Object.assign(new Error('Consumable group not found'), { code: 'NOT_FOUND' });
  }
  await prisma.consumableGroup.delete({ where: { id } });
}
