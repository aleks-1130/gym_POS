-- DropIndex
DROP INDEX "Category_name_key";

-- DropIndex
DROP INDEX "Coupon_code_key";

-- DropIndex
DROP INDEX "Payment_referenceId_key";

-- DropIndex
DROP INDEX "Product_sku_key";

-- DropIndex
DROP INDEX "PromoCode_code_key";

-- DropIndex
DROP INDEX "StockOrder_orderNumber_key";

-- AlterTable
ALTER TABLE "AccessLog" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "ClassHistory" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "ClassSession" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "ClassSessionPackage" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "GymProfile" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "LoyaltyReward" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "LoyaltyTransaction" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "MemberNote" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "MembershipPeriod" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "NotificationPreference" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "PaymentItem" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "PaymentMethod" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "PosConfig" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "PromoCode" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "SessionMaterial" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "StockOrder" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "StockOrderItem" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "Trainer" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "TrainerAvailability" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "TrainerChangeRequest" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "TrainingSession" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "gymId" INTEGER;

-- AlterTable
CREATE SEQUENCE payroll_config_id_seq;
ALTER TABLE "payroll_config" ADD COLUMN     "gymId" INTEGER,
ALTER COLUMN "id" SET DEFAULT nextval('payroll_config_id_seq');
ALTER SEQUENCE payroll_config_id_seq OWNED BY "payroll_config"."id";

-- AlterTable
CREATE SEQUENCE receipt_settings_id_seq;
ALTER TABLE "receipt_settings" ADD COLUMN     "gymId" INTEGER,
ALTER COLUMN "id" SET DEFAULT nextval('receipt_settings_id_seq');
ALTER SEQUENCE receipt_settings_id_seq OWNED BY "receipt_settings"."id";

-- CreateTable
CREATE TABLE "Tenant" (
    "id" SERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gym" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 12.0,
    "roundingRule" TEXT NOT NULL DEFAULT 'NONE',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Manila',
    "referencePrefix" TEXT NOT NULL DEFAULT 'A321',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gym_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialInstitution" (
    "id" SERIAL NOT NULL,
    "gymId" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "financialInstitutionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialInstitution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentCollection" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "financialInstitutionId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentCollection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_tenantId_key" ON "Tenant"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Gym_companyId_key" ON "Gym"("companyId");

-- CreateIndex
CREATE INDEX "Gym_tenantId_idx" ON "Gym"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialInstitution_gymId_method_key" ON "FinancialInstitution"("gymId", "method");

-- CreateIndex
CREATE INDEX "PaymentCollection_paymentId_idx" ON "PaymentCollection"("paymentId");

-- CreateIndex
CREATE INDEX "AccessLog_gymId_idx" ON "AccessLog"("gymId");

-- CreateIndex
CREATE INDEX "AuditLog_gymId_idx" ON "AuditLog"("gymId");

-- CreateIndex
CREATE INDEX "Booking_gymId_idx" ON "Booking"("gymId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_gymId_key" ON "Category"("name", "gymId");

-- CreateIndex
CREATE INDEX "Class_gymId_idx" ON "Class"("gymId");

-- CreateIndex
CREATE INDEX "ClassHistory_gymId_idx" ON "ClassHistory"("gymId");

-- CreateIndex
CREATE INDEX "ClassSession_gymId_idx" ON "ClassSession"("gymId");

-- CreateIndex
CREATE INDEX "Coupon_gymId_idx" ON "Coupon"("gymId");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_gymId_key" ON "Coupon"("code", "gymId");

-- CreateIndex
CREATE INDEX "Expense_gymId_idx" ON "Expense"("gymId");

-- CreateIndex
CREATE INDEX "GymProfile_gymId_idx" ON "GymProfile"("gymId");

-- CreateIndex
CREATE INDEX "LoyaltyReward_gymId_idx" ON "LoyaltyReward"("gymId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_gymId_idx" ON "LoyaltyTransaction"("gymId");

-- CreateIndex
CREATE INDEX "Member_gymId_idx" ON "Member"("gymId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_email_gymId_key" ON "Member"("email", "gymId");

-- CreateIndex
CREATE INDEX "MemberNote_gymId_idx" ON "MemberNote"("gymId");

-- CreateIndex
CREATE INDEX "MembershipPeriod_gymId_idx" ON "MembershipPeriod"("gymId");

-- CreateIndex
CREATE INDEX "Notification_gymId_idx" ON "Notification"("gymId");

-- CreateIndex
CREATE INDEX "NotificationPreference_gymId_idx" ON "NotificationPreference"("gymId");

-- CreateIndex
CREATE INDEX "Order_gymId_idx" ON "Order"("gymId");

-- CreateIndex
CREATE INDEX "OrderItem_gymId_idx" ON "OrderItem"("gymId");

-- CreateIndex
CREATE INDEX "Payment_gymId_idx" ON "Payment"("gymId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_companyId_referenceId_key" ON "Payment"("companyId", "referenceId");

-- CreateIndex
CREATE INDEX "PaymentItem_gymId_idx" ON "PaymentItem"("gymId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_gymId_key" ON "Plan"("name", "gymId");

-- CreateIndex
CREATE INDEX "PosConfig_gymId_idx" ON "PosConfig"("gymId");

-- CreateIndex
CREATE INDEX "Product_gymId_idx" ON "Product"("gymId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_gymId_key" ON "Product"("sku", "gymId");

-- CreateIndex
CREATE INDEX "PromoCode_gymId_idx" ON "PromoCode"("gymId");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_gymId_key" ON "PromoCode"("code", "gymId");

-- CreateIndex
CREATE INDEX "SessionMaterial_gymId_idx" ON "SessionMaterial"("gymId");

-- CreateIndex
CREATE INDEX "StockOrder_gymId_idx" ON "StockOrder"("gymId");

-- CreateIndex
CREATE UNIQUE INDEX "StockOrder_orderNumber_gymId_key" ON "StockOrder"("orderNumber", "gymId");

-- CreateIndex
CREATE INDEX "StockOrderItem_gymId_idx" ON "StockOrderItem"("gymId");

-- CreateIndex
CREATE INDEX "Supplier_gymId_idx" ON "Supplier"("gymId");

-- CreateIndex
CREATE INDEX "Trainer_gymId_idx" ON "Trainer"("gymId");

-- CreateIndex
CREATE INDEX "TrainerAvailability_gymId_idx" ON "TrainerAvailability"("gymId");

-- CreateIndex
CREATE INDEX "TrainerChangeRequest_gymId_idx" ON "TrainerChangeRequest"("gymId");

-- CreateIndex
CREATE INDEX "TrainingSession_gymId_idx" ON "TrainingSession"("gymId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_gymId_key" ON "User"("email", "gymId");

-- CreateIndex
CREATE INDEX "payroll_config_gymId_idx" ON "payroll_config"("gymId");

-- CreateIndex
CREATE INDEX "receipt_settings_gymId_idx" ON "receipt_settings"("gymId");

-- AddForeignKey
ALTER TABLE "Gym" ADD CONSTRAINT "Gym_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialInstitution" ADD CONSTRAINT "FinancialInstitution_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCollection" ADD CONSTRAINT "PaymentCollection_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSessionPackage" ADD CONSTRAINT "ClassSessionPackage_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentItem" ADD CONSTRAINT "PaymentItem_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOrder" ADD CONSTRAINT "StockOrder_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOrderItem" ADD CONSTRAINT "StockOrderItem_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trainer" ADD CONSTRAINT "Trainer_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerChangeRequest" ADD CONSTRAINT "TrainerChangeRequest_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerAvailability" ADD CONSTRAINT "TrainerAvailability_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMaterial" ADD CONSTRAINT "SessionMaterial_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassHistory" ADD CONSTRAINT "ClassHistory_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPeriod" ADD CONSTRAINT "MembershipPeriod_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyReward" ADD CONSTRAINT "LoyaltyReward_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosConfig" ADD CONSTRAINT "PosConfig_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_settings" ADD CONSTRAINT "receipt_settings_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberNote" ADD CONSTRAINT "MemberNote_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymProfile" ADD CONSTRAINT "GymProfile_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_config" ADD CONSTRAINT "payroll_config_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

