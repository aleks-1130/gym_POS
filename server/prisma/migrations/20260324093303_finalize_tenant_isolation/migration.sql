-- AlterTable
ALTER TABLE "Category" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "LoyaltyReward" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "PosConfig" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "StockOrder" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Supplier" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "payroll_config" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "receipt_settings" ALTER COLUMN "tenantId" SET NOT NULL;

