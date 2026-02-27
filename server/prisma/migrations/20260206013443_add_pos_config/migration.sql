-- CreateTable
CREATE TABLE "PosConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "voidPinHash" TEXT,
    "returnPinHash" TEXT,
    "updatedAt" DATETIME NOT NULL
);
