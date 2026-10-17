-- Consumables & Packaging: a third expense kind, separate from ingredient
-- purchases (COGS) and fixed expenses (rent, salaries, utilities).
-- Additive only. Existing ledger rows are not changed.

ALTER TYPE "TransactionType" ADD VALUE 'expense_consumable';

CREATE TABLE "consumable_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consumable_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "consumable_items_name_key" ON "consumable_items"("name");

CREATE TABLE "consumable_cost_records" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "consumableItemId" TEXT,
    "supplierId" TEXT,
    "supplierSnapshot" TEXT,
    "group_name" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "quantity" DECIMAL(12,3),
    "unit" "UnitType",
    "unitPrice" DECIMAL(12,2),
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consumable_cost_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "consumable_cost_records_transactionId_key" ON "consumable_cost_records"("transactionId");
CREATE INDEX "consumable_cost_records_date_idx" ON "consumable_cost_records"("date");
CREATE INDEX "consumable_cost_records_group_name_idx" ON "consumable_cost_records"("group_name");
CREATE INDEX "consumable_cost_records_consumableItemId_idx" ON "consumable_cost_records"("consumableItemId");
CREATE INDEX "consumable_cost_records_supplierId_idx" ON "consumable_cost_records"("supplierId");

ALTER TABLE "consumable_cost_records" ADD CONSTRAINT "consumable_cost_records_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consumable_cost_records" ADD CONSTRAINT "consumable_cost_records_consumableItemId_fkey" FOREIGN KEY ("consumableItemId") REFERENCES "consumable_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "consumable_cost_records" ADD CONSTRAINT "consumable_cost_records_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
