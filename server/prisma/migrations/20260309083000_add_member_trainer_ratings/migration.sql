ALTER TABLE "TrainingSession"
ADD COLUMN "memberRating" INTEGER,
ADD COLUMN "memberRatedAt" TIMESTAMP(3);

ALTER TABLE "Trainer"
ALTER COLUMN "rating" SET DEFAULT 0.0;

UPDATE "Trainer"
SET "rating" = 0.0;
