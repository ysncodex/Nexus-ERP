-- Add sale_transaction_id to delivery_settlements — used when a settlement is
-- marked "received" into cash/bank/bkash (the deposit becomes real sales
-- revenue and needs to flow into Dashboard/Reports). Reserve Fund deposits
-- keep using fund_movement_id instead (unchanged).

ALTER TABLE "delivery_settlements"
  ADD COLUMN "sale_transaction_id" TEXT;

ALTER TABLE "delivery_settlements"
  ADD CONSTRAINT "delivery_settlements_sale_transaction_id_key" UNIQUE ("sale_transaction_id");

ALTER TABLE "delivery_settlements"
  ADD CONSTRAINT "delivery_settlements_sale_transaction_id_fkey"
  FOREIGN KEY ("sale_transaction_id") REFERENCES "transactions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
