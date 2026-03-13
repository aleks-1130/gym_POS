/*
  Warnings:

  - A unique constraint covering the columns `[resetPasswordToken]` on the table `Member` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[referenceId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[resetPasswordToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "sessionDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "daysOfWeek" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "oneTimeDate" TIMESTAMP(3),
ADD COLUMN     "scheduleType" TEXT NOT NULL DEFAULT 'RECURRING',
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "resetPasswordExpires" TIMESTAMP(3),
ADD COLUMN     "resetPasswordToken" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "isAnnouncement" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "memberId" INTEGER;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'PHP',
ADD COLUMN     "financialInstitutionId" TEXT,
ADD COLUMN     "payableAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "referenceId" TEXT,
ADD COLUMN     "roundingAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "taxableAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetPasswordExpires" TIMESTAMP(3),
ADD COLUMN     "resetPasswordToken" TEXT;

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockOrder" (
    "id" SERIAL NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdBy" INTEGER,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "totalLineItems" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "StockOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockOrderItem" (
    "id" SERIAL NOT NULL,
    "stockOrderId" INTEGER NOT NULL,
    "productId" INTEGER,
    "name" TEXT NOT NULL,
    "barcode" TEXT,
    "imageUrl" TEXT,
    "category" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "StockOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerAvailability" (
    "id" SERIAL NOT NULL,
    "trainerId" INTEGER NOT NULL,
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainerAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSession" (
    "id" SERIAL NOT NULL,
    "classId" INTEGER NOT NULL,
    "trainerId" INTEGER NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "startedByRole" TEXT,
    "completedByRole" TEXT,
    "completionNote" TEXT,
    "isAutoStarted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipt_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "StockOrder_orderNumber_key" ON "StockOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "StockOrder_createdAt_idx" ON "StockOrder"("createdAt");

-- CreateIndex
CREATE INDEX "StockOrder_status_idx" ON "StockOrder"("status");

-- CreateIndex
CREATE INDEX "StockOrder_supplierId_idx" ON "StockOrder"("supplierId");

-- CreateIndex
CREATE INDEX "StockOrderItem_stockOrderId_idx" ON "StockOrderItem"("stockOrderId");

-- CreateIndex
CREATE INDEX "StockOrderItem_productId_idx" ON "StockOrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainerAvailability_trainerId_key" ON "TrainerAvailability"("trainerId");

-- CreateIndex
CREATE INDEX "TrainerAvailability_updatedAt_idx" ON "TrainerAvailability"("updatedAt");

-- CreateIndex
CREATE INDEX "ClassSession_trainerId_sessionDate_idx" ON "ClassSession"("trainerId", "sessionDate");

-- CreateIndex
CREATE INDEX "ClassSession_status_sessionDate_idx" ON "ClassSession"("status", "sessionDate");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSession_classId_sessionDate_key" ON "ClassSession"("classId", "sessionDate");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE INDEX "Booking_classId_sessionDate_idx" ON "Booking"("classId", "sessionDate");

-- CreateIndex
CREATE INDEX "Booking_memberId_sessionDate_idx" ON "Booking"("memberId", "sessionDate");

-- CreateIndex
CREATE UNIQUE INDEX "Member_resetPasswordToken_key" ON "Member"("resetPasswordToken");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_referenceId_key" ON "Payment"("referenceId");

-- CreateIndex
CREATE INDEX "Payment_referenceId_idx" ON "Payment"("referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetPasswordToken_key" ON "User"("resetPasswordToken");

-- AddForeignKey
ALTER TABLE "StockOrder" ADD CONSTRAINT "StockOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOrder" ADD CONSTRAINT "StockOrder_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOrderItem" ADD CONSTRAINT "StockOrderItem_stockOrderId_fkey" FOREIGN KEY ("stockOrderId") REFERENCES "StockOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOrderItem" ADD CONSTRAINT "StockOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerAvailability" ADD CONSTRAINT "TrainerAvailability_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "Trainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "Trainer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
