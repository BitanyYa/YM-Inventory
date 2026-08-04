/*
  Warnings:

  - You are about to drop the column `imei` on the `StockMovement` table. All the data in the column will be lost.
  - You are about to drop the column `storage` on the `StockMovement` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "TrackingType" AS ENUM ('SERIALIZED', 'QUANTITY');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('AVAILABLE', 'IN_SHOP', 'SOLD', 'RETURNED', 'DAMAGED');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "trackingType" "TrackingType" NOT NULL DEFAULT 'QUANTITY';

-- AlterTable
ALTER TABLE "StockMovement" DROP COLUMN "imei",
DROP COLUMN "storage",
ADD COLUMN     "productUnitId" TEXT;

-- CreateTable
CREATE TABLE "ProductUnit" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "serialNumber" TEXT,
    "imei" TEXT,
    "storage" INTEGER,
    "color" TEXT,
    "purchasePrice" DECIMAL(10,2),
    "location" "Location" NOT NULL,
    "status" "UnitStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductUnit_imei_key" ON "ProductUnit"("imei");

-- AddForeignKey
ALTER TABLE "ProductUnit" ADD CONSTRAINT "ProductUnit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productUnitId_fkey" FOREIGN KEY ("productUnitId") REFERENCES "ProductUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
