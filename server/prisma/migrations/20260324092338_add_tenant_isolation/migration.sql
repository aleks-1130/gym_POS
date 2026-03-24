-- DropForeignKey
ALTER TABLE "FinancialInstitution" DROP CONSTRAINT "FinancialInstitution_gymId_fkey";

-- DropForeignKey
ALTER TABLE "Gym" DROP CONSTRAINT "Gym_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "Member" DROP CONSTRAINT "Member_gymId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_gymId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_tenantId_fkey";

-- DropIndex
DROP INDEX "Category_name_gymId_key";

-- DropIndex
DROP INDEX "Product_sku_gymId_key";

-- DropIndex
DROP INDEX "StockOrder_orderNumber_gymId_key";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "isGlobal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tenantId" INTEGER;

-- AlterTable
ALTER TABLE "ClassSessionPackage" ALTER COLUMN "isGlobal" SET NOT NULL;

-- AlterTable
ALTER TABLE "LoyaltyReward" ADD COLUMN     "isGlobal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tenantId" INTEGER;

-- AlterTable
ALTER TABLE "Plan" ALTER COLUMN "isGlobal" SET NOT NULL;

-- AlterTable
ALTER TABLE "PosConfig" ADD COLUMN     "isGlobal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tenantId" INTEGER;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "tenantId" INTEGER;

-- AlterTable
ALTER TABLE "StockOrder" ADD COLUMN     "tenantId" INTEGER;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "isGlobal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tenantId" INTEGER;

-- AlterTable
ALTER TABLE "Tenant" ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "payroll_config" ADD COLUMN     "isGlobal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tenantId" INTEGER;

-- AlterTable
ALTER TABLE "receipt_settings" ADD COLUMN     "isGlobal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tenantId" INTEGER;

-- CreateIndex
CREATE INDEX "Category_tenantId_idx" ON "Category"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_tenantId_key" ON "Category"("name", "tenantId");

-- CreateIndex
CREATE INDEX "LoyaltyReward_tenantId_idx" ON "LoyaltyReward"("tenantId");

-- CreateIndex
CREATE INDEX "PosConfig_tenantId_idx" ON "PosConfig"("tenantId");

-- CreateIndex
CREATE INDEX "Product_tenantId_idx" ON "Product"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_tenantId_key" ON "Product"("sku", "tenantId");

-- CreateIndex
CREATE INDEX "PromoCode_tenantId_idx" ON "PromoCode"("tenantId");

-- CreateIndex
CREATE INDEX "StockOrder_tenantId_idx" ON "StockOrder"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "StockOrder_orderNumber_tenantId_key" ON "StockOrder"("orderNumber", "tenantId");

-- CreateIndex
CREATE INDEX "Supplier_tenantId_idx" ON "Supplier"("tenantId");

-- CreateIndex
CREATE INDEX "payroll_config_tenantId_idx" ON "payroll_config"("tenantId");

-- CreateIndex
CREATE INDEX "receipt_settings_tenantId_idx" ON "receipt_settings"("tenantId");

-- AddForeignKey
ALTER TABLE "Gym" ADD CONSTRAINT "Gym_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialInstitution" ADD CONSTRAINT "FinancialInstitution_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSessionPackage" ADD CONSTRAINT "ClassSessionPackage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOrder" ADD CONSTRAINT "StockOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyReward" ADD CONSTRAINT "LoyaltyReward_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosConfig" ADD CONSTRAINT "PosConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_settings" ADD CONSTRAINT "receipt_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_config" ADD CONSTRAINT "payroll_config_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

