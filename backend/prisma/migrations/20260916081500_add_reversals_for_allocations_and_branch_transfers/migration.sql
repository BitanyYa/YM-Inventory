-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.
ALTER TYPE "MovementType" ADD VALUE 'ALLOCATION_REVERSAL';
ALTER TYPE "MovementType" ADD VALUE 'BRANCH_TRANSFER_REVERSAL';

-- AlterTable
ALTER TABLE "ProductAllocation" ADD COLUMN     "reversedQuantity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "BranchTransfer" ADD COLUMN     "reversedQuantity" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ProductAllocationReversal" (
    "id" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "reversedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAllocationReversal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchTransferReversal" (
    "id" TEXT NOT NULL,
    "branchTransferId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "reversedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BranchTransferReversal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductAllocationReversal_allocationId_idx" ON "ProductAllocationReversal"("allocationId");

-- CreateIndex
CREATE INDEX "ProductAllocationReversal_salespersonId_idx" ON "ProductAllocationReversal"("salespersonId");

-- CreateIndex
CREATE INDEX "ProductAllocationReversal_productId_idx" ON "ProductAllocationReversal"("productId");

-- CreateIndex
CREATE INDEX "ProductAllocationReversal_createdAt_idx" ON "ProductAllocationReversal"("createdAt");

-- CreateIndex
CREATE INDEX "BranchTransferReversal_branchTransferId_idx" ON "BranchTransferReversal"("branchTransferId");

-- CreateIndex
CREATE INDEX "BranchTransferReversal_branchId_idx" ON "BranchTransferReversal"("branchId");

-- CreateIndex
CREATE INDEX "BranchTransferReversal_productId_idx" ON "BranchTransferReversal"("productId");

-- CreateIndex
CREATE INDEX "BranchTransferReversal_createdAt_idx" ON "BranchTransferReversal"("createdAt");

-- AddForeignKey
ALTER TABLE "ProductAllocationReversal" ADD CONSTRAINT "ProductAllocationReversal_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "ProductAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAllocationReversal" ADD CONSTRAINT "ProductAllocationReversal_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "Salesperson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAllocationReversal" ADD CONSTRAINT "ProductAllocationReversal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAllocationReversal" ADD CONSTRAINT "ProductAllocationReversal_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchTransferReversal" ADD CONSTRAINT "BranchTransferReversal_branchTransferId_fkey" FOREIGN KEY ("branchTransferId") REFERENCES "BranchTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchTransferReversal" ADD CONSTRAINT "BranchTransferReversal_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchTransferReversal" ADD CONSTRAINT "BranchTransferReversal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchTransferReversal" ADD CONSTRAINT "BranchTransferReversal_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
