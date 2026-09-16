-- CreateTable
CREATE TABLE "Salesperson" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Salesperson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Salesperson_name_idx" ON "Salesperson"("name");

-- CreateIndex
CREATE INDEX "Salesperson_isActive_idx" ON "Salesperson"("isActive");

-- Data Migration: Migrate ONLY Users referenced as salespeople in SalespersonStock or ProductAllocation
INSERT INTO "Salesperson" ("id", "name", "phone", "isActive", "createdAt", "updatedAt")
SELECT DISTINCT
    u."id",
    u."name",
    NULL AS "phone",
    TRUE AS "isActive",
    u."createdAt",
    CURRENT_TIMESTAMP AS "updatedAt"
FROM "User" u
WHERE u."id" IN (SELECT "salespersonId" FROM "SalespersonStock")
   OR u."id" IN (SELECT "salespersonId" FROM "ProductAllocation")
ON CONFLICT ("id") DO NOTHING;

-- DropForeignKey
ALTER TABLE "SalespersonStock" DROP CONSTRAINT "SalespersonStock_salespersonId_fkey";

-- DropForeignKey
ALTER TABLE "ProductAllocation" DROP CONSTRAINT "ProductAllocation_salespersonId_fkey";

-- AddForeignKey
ALTER TABLE "SalespersonStock" ADD CONSTRAINT "SalespersonStock_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "Salesperson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAllocation" ADD CONSTRAINT "ProductAllocation_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "Salesperson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
