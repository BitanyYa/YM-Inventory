-- CreateTable
CREATE TABLE "StockMovementUnit" (
    "id" TEXT NOT NULL,
    "stockMovementId" TEXT NOT NULL,
    "productUnitId" TEXT NOT NULL,

    CONSTRAINT "StockMovementUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockMovementUnit_stockMovementId_idx" ON "StockMovementUnit"("stockMovementId");

-- CreateIndex
CREATE INDEX "StockMovementUnit_productUnitId_idx" ON "StockMovementUnit"("productUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovementUnit_stockMovementId_productUnitId_key" ON "StockMovementUnit"("stockMovementId", "productUnitId");

-- AddForeignKey
ALTER TABLE "StockMovementUnit" ADD CONSTRAINT "StockMovementUnit_stockMovementId_fkey" FOREIGN KEY ("stockMovementId") REFERENCES "StockMovement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovementUnit" ADD CONSTRAINT "StockMovementUnit_productUnitId_fkey" FOREIGN KEY ("productUnitId") REFERENCES "ProductUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
