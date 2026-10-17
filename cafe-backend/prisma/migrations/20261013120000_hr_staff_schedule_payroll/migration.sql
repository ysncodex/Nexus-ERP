-- HR: Staff Schedule + Payroll (additive only — no existing table is changed)

-- Reference code sequences
CREATE SEQUENCE IF NOT EXISTS "staff_member_code_seq";
CREATE SEQUENCE IF NOT EXISTS "payroll_record_code_seq";

-- CreateEnum
CREATE TYPE "ShiftAttendance" AS ENUM ('scheduled', 'present', 'late', 'absent', 'leave', 'cancelled');

-- CreateEnum
CREATE TYPE "PayrollStage" AS ENUM ('draft', 'approved', 'void');

-- CreateTable
CREATE TABLE "staff_members" (
    "id" TEXT NOT NULL,
    "code" TEXT DEFAULT ('STF-'::text || lpad((nextval('staff_member_code_seq'::regclass))::text, 4, '0'::text)),
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_shifts" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "shift_date" TIMESTAMP(3) NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "overnight" BOOLEAN NOT NULL DEFAULT false,
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "status" "ShiftAttendance" NOT NULL DEFAULT 'scheduled',
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_records" (
    "id" TEXT NOT NULL,
    "code" TEXT DEFAULT ('PAY-'::text || lpad((nextval('payroll_record_code_seq'::regclass))::text, 6, '0'::text)),
    "staff_id" TEXT NOT NULL,
    "staff_name" TEXT NOT NULL,
    "staff_role" TEXT NOT NULL DEFAULT '',
    "month" VARCHAR(7) NOT NULL,
    "basic_salary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "allowance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "bonus" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "overtime" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "stage" "PayrollStage" NOT NULL DEFAULT 'draft',
    "active_key" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "approved_at" TIMESTAMP(3),
    "voided_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_payments" (
    "id" TEXT NOT NULL,
    "payroll_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paid_on" TIMESTAMP(3) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "transaction_id" TEXT,
    "request_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_members_code_key" ON "staff_members"("code");

-- CreateIndex
CREATE INDEX "staff_members_active_idx" ON "staff_members"("active");

-- CreateIndex
CREATE INDEX "staff_shifts_shift_date_idx" ON "staff_shifts"("shift_date");

-- CreateIndex
CREATE INDEX "staff_shifts_staff_id_shift_date_idx" ON "staff_shifts"("staff_id", "shift_date");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_records_code_key" ON "payroll_records"("code");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_records_active_key_key" ON "payroll_records"("active_key");

-- CreateIndex
CREATE INDEX "payroll_records_month_idx" ON "payroll_records"("month");

-- CreateIndex
CREATE INDEX "payroll_records_staff_id_idx" ON "payroll_records"("staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_payments_transaction_id_key" ON "payroll_payments"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_payments_request_id_key" ON "payroll_payments"("request_id");

-- CreateIndex
CREATE INDEX "payroll_payments_payroll_id_idx" ON "payroll_payments"("payroll_id");

-- AddForeignKey
ALTER TABLE "staff_shifts" ADD CONSTRAINT "staff_shifts_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_payroll_id_fkey" FOREIGN KEY ("payroll_id") REFERENCES "payroll_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
