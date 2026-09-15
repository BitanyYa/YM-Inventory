-- DropForeignKey
ALTER TABLE "ProductAllocation" DROP CONSTRAINT "ProductAllocation_salespersonId_fkey";

-- DropForeignKey
ALTER TABLE "ProductAllocation" DROP CONSTRAINT "ProductAllocation_productId_fkey";

-- DropForeignKey
ALTER TABLE "BranchTransfer" DROP CONSTRAINT "BranchTransfer_branchId_fkey";

-- DropForeignKey
ALTER TABLE "BranchTransfer" DROP CONSTRAINT "BranchTransfer_productId_fkey";

-- AddForeignKey
ALTER TABLE "ProductAllocation" ADD CONSTRAINT "ProductAllocation_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAllocation" ADD CONSTRAINT "ProductAllocation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchTransfer" ADD CONSTRAINT "BranchTransfer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchTransfer" ADD CONSTRAINT "BranchTransfer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
