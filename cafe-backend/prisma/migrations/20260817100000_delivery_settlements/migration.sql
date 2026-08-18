-- Delivery Platform Settlements (Foodpanda/Foodi income reconciliation)

-- ── Enums ────────────────────────────────────────────────────────────────────
CREATE TYPE "DeliveryPlatform" AS ENUM ('foodpanda', 'foodi', 'other');
CREATE TYPE "SettlementStatus" AS ENUM ('pending', 'received', 'disputed');

-- ── Reference code sequence ──────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS "delivery_settlement_code_seq";

-- ── Delivery settlements ──────────────────────────────────────────────────────
CREATE TABLE "delivery_settlements" (
    "id" TEXT NOT NULL,
    "code" TEXT DEFAULT ('SET-'::text || lpad((nextval('delivery_settlement_code_seq'::regclass))::text, 6, '0'::text)),
    "platform" "DeliveryPlatform" NOT NULL,
    "platform_other" TEXT,
    "settlement_number" TEXT,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "gross_amount" DECIMAL(12,2) NOT NULL,
    "commission_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "other_deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(12,2) NOT NULL,
    "net_amount_received" DECIMAL(12,2),
    "received_date" TIMESTAMP(3),
    "bank_account" "FundAccountType",
    "status" "SettlementStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT NOT NULL DEFAULT '',
    "fund_movement_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_settlements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "delivery_settlements_code_key" ON "delivery_settlements"("code");
CREATE UNIQUE INDEX "delivery_settlements_fund_movement_id_key" ON "delivery_settlements"("fund_movement_id");
CREATE INDEX "delivery_settlements_platform_period_start_idx" ON "delivery_settlements"("platform", "period_start");
CREATE INDEX "delivery_settlements_status_idx" ON "delivery_settlements"("status");

ALTER TABLE "delivery_settlements" ADD CONSTRAINT "delivery_settlements_fund_movement_id_fkey"
  FOREIGN KEY ("fund_movement_id") REFERENCES "fund_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "delivery_settlements" ADD CONSTRAINT "delivery_settlements_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
