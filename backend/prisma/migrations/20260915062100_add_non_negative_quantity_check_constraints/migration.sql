-- AddCheckConstraint
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_quantity_non_negative" CHECK ("quantity" >= 0);

-- AddCheckConstraint
ALTER TABLE "BranchInventory" ADD CONSTRAINT "BranchInventory_quantity_non_negative" CHECK ("quantity" >= 0);

-- AddCheckConstraint
ALTER TABLE "SalespersonStock" ADD CONSTRAINT "SalespersonStock_quantity_non_negative" CHECK ("quantity" >= 0);
