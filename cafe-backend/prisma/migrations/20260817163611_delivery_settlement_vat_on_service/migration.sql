-- Rename delivery_settlements.other_deductions -> vat_on_service
ALTER TABLE "delivery_settlements" RENAME COLUMN "other_deductions" TO "vat_on_service";
