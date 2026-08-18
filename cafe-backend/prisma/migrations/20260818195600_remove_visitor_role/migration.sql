-- Remove visitor accounts before shrinking the Role enum.
-- Related fund_movements / delivery_settlements use ON DELETE SET NULL on createdById.
DELETE FROM "users" WHERE "role" = 'visitor';

-- AlterEnum: drop `visitor` from Role (PostgreSQL cannot DROP an enum value in-place on all versions).
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('owner', 'manager');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
COMMIT;
