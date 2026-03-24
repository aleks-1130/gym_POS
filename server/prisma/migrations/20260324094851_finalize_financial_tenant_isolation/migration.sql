-- AlterTable
ALTER TABLE "AccessLog" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Expense" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "PaymentItem" ALTER COLUMN "tenantId" SET NOT NULL;

