-- Consumables & Packaging: manageable costing groups.
--
-- The group used to be a hard-coded enum in application code. Owners/managers
-- can now add, rename and delete groups, so the live list needs a table.
--
-- Additive and idempotent: safe to run on a database that already has the
-- table (e.g. one where an earlier hand-applied attempt partially succeeded).
-- No existing row is modified or deleted.

CREATE TABLE IF NOT EXISTS "consumable_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumable_groups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "consumable_groups_name_key" ON "consumable_groups"("name");

-- Default buckets so the picker is useful immediately.
INSERT INTO "consumable_groups" ("id", "name", "createdAt", "updatedAt") VALUES
  ('cg_cups',    'Cups',    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cg_lids',    'Lids',    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cg_bags',    'Bags',    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cg_boxes',   'Boxes',   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cg_napkins', 'Napkins', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cg_straws',  'Straws',  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cg_other',   'Other',   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

-- Backfill any group already present on historical consumable rows so the
-- Manage Groups list never hides a bucket that real expenses point at.
INSERT INTO "consumable_groups" ("id", "name", "createdAt", "updatedAt")
SELECT
  'cg_bf_' || md5(src."group_name"),
  src."group_name",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT btrim("group_name") AS "group_name"
  FROM "consumable_cost_records"
  WHERE "group_name" IS NOT NULL AND btrim("group_name") <> ''
) AS src
ON CONFLICT ("name") DO NOTHING;
