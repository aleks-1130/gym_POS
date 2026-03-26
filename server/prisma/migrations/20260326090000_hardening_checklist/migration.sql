-- Keep at most one payroll config row per gym.
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY "gymId" ORDER BY "updatedAt" DESC, id DESC) AS rn
    FROM "payroll_config"
    WHERE "gymId" IS NOT NULL
)
DELETE FROM "payroll_config" pc
USING ranked r
WHERE pc.id = r.id
  AND r.rn > 1;

-- Backfill missing gymId from the first gym found in each tenant.
WITH tenant_default_gym AS (
    SELECT DISTINCT ON ("tenantId")
        "tenantId",
        id AS "gymId"
    FROM "Gym"
    ORDER BY "tenantId", id
)
UPDATE "payroll_config" pc
SET "gymId" = tdg."gymId"
FROM tenant_default_gym tdg
WHERE pc."gymId" IS NULL
  AND pc."tenantId" = tdg."tenantId";

-- Remove rows that still have no gym and enforce strict per-gym config.
DELETE FROM "payroll_config"
WHERE "gymId" IS NULL;

ALTER TABLE "payroll_config"
ALTER COLUMN "gymId" SET NOT NULL;

DROP INDEX IF EXISTS "payroll_config_gymId_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_config_gymId_key"
    ON "payroll_config"("gymId");

-- Remove deprecated gym profile table.
DROP TABLE IF EXISTS "GymProfile";

-- Speed up user queries filtered by gym.
CREATE INDEX IF NOT EXISTS "User_gymId_idx"
    ON "User"("gymId");
