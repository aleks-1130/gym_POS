ALTER TABLE "TrainingSession"
ADD COLUMN "memberRatingComment" TEXT,
ADD COLUMN "memberRatingVoided" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "memberRatingVoidedAt" TIMESTAMP(3);

UPDATE "TrainingSession"
SET "memberRatingVoided" = false
WHERE "memberRatingVoided" IS NULL;
