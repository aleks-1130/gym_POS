ALTER TABLE "Trainer"
ADD COLUMN "cardImageUrl" TEXT;

UPDATE "Trainer"
SET "cardImageUrl" = "imageUrl"
WHERE "cardImageUrl" IS NULL
  AND "imageUrl" IS NOT NULL;
