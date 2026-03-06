-- Add trainer status description for member-facing messaging
ALTER TABLE "Trainer"
ADD COLUMN "statusDescription" TEXT;

-- Create profile/status change request workflow table
CREATE TABLE "TrainerChangeRequest" (
    "id" SERIAL NOT NULL,
    "trainerId" INTEGER NOT NULL,
    "requestedById" INTEGER,
    "requestType" TEXT NOT NULL DEFAULT 'PROFILE_UPDATE',
    "payload" JSONB NOT NULL,
    "currentData" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_ADMIN',
    "adminDecisionBy" INTEGER,
    "adminDecisionAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "ownerDecisionBy" INTEGER,
    "ownerDecisionAt" TIMESTAMP(3),
    "ownerNote" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainerChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrainerChangeRequest_trainerId_idx" ON "TrainerChangeRequest"("trainerId");
CREATE INDEX "TrainerChangeRequest_status_idx" ON "TrainerChangeRequest"("status");
CREATE INDEX "TrainerChangeRequest_createdAt_idx" ON "TrainerChangeRequest"("createdAt");

ALTER TABLE "TrainerChangeRequest"
ADD CONSTRAINT "TrainerChangeRequest_trainerId_fkey"
FOREIGN KEY ("trainerId") REFERENCES "Trainer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainerChangeRequest"
ADD CONSTRAINT "TrainerChangeRequest_requestedById_fkey"
FOREIGN KEY ("requestedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TrainerChangeRequest"
ADD CONSTRAINT "TrainerChangeRequest_adminDecisionBy_fkey"
FOREIGN KEY ("adminDecisionBy") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TrainerChangeRequest"
ADD CONSTRAINT "TrainerChangeRequest_ownerDecisionBy_fkey"
FOREIGN KEY ("ownerDecisionBy") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
