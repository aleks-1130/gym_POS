-- Add persisted loyalty points for trainer/staff accounts
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loyaltyPoints" INTEGER NOT NULL DEFAULT 0;
