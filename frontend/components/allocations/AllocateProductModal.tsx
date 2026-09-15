'use client';

import React, { useEffect, useState } from 'react';
import { InventoryProductItem, User } from '../../types/api';
import { salespersonStockService } from '../../services/salesperson-stock.service';
import { inventoryService, invalidateInventoryCache } from '../../services/inventory.service';
import { categoryService } from '../../services/category.service';
import { productService } from '../../services/product.service';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { CloseIcon, AlertTriangleIcon } from '../ui/Icons';

interface AllocateProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AllocateProductModal: React.FC<AllocateProductModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [allocatableProducts, setAllocatableProducts] = useState<InventoryProductItem[]>([]);
  const [selectedSalespersonId, setSelectedSalespersonId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [note, setNote] = useState<string>('');

  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setIsLoadingInitial(true);
      setError(null);
      try {
        const [usersData, inventoryRes, categoriesData] = await Promise.all([
          salespersonStockService.getUsers(),
          inventoryService.getInventory({ limit: 100 }),
          categoryService.getCategories(),
        ]);

        setUsers(usersData || []);

        const enabledCategoryIds = new Set(
          (categoriesData || []).filter((c) => c.allocationEnabled).map((c) => c.id),
        );

        const allocatable = (inventoryRes.data || []).filter(
          (item) =>
            item.isActive &&
            item.trackingType === 'QUANTITY' &&
            item.category &&
            (item.category.allocationEnabled === true || enabledCategoryIds.has(item.category.id)),
        );

        setAllocatableProducts(allocatable);

        if (usersData && usersData.length > 0) {
          setSelectedSalespersonId((prev) => prev || usersData[0].id);
        }
        if (allocatable.length > 0) {
          setSelectedProductId((prev) => (allocatable.some((p) => p.id === prev) ? prev : allocatable[0].id));
        } else {
          setSelectedProductId('');
        }
      } catch (err: unknown) {
        setError((err as { message?: string })?.message || 'Failed to load allocation options.');
      } finally {
        setIsLoadingInitial(false);
      }
    };

    loadData();
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedProduct = allocatableProducts.find((p) => p.id === selectedProductId);
  const shopAvailable = selectedProduct?.inventory?.shopQuantity ?? 0;
  const numQuantity = parseInt(quantity, 10);
  const isQuantityValid =
    !isNaN(numQuantity) && numQuantity >= 1 && numQuantity <= shopAvailable && shopAvailable > 0;

  const resetForm = () => {
    setQuantity('1');
    setNote('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSalespersonId || !selectedProductId || !isQuantityValid) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await salespersonStockService.allocateProduct({
        productId: selectedProductId,
        salespersonId: selectedSalespersonId,
        quantity: numQuantity,
        note: note.trim() || undefined,
      });

      invalidateInventoryCache();
      productService.clearCache();
      resetForm();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to allocate product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      {/* modal box */}
      <div className="relative w-full max-w-md rounded-2xl border border-[#D2D2D7] bg-white shadow-2xl dark:border-[#38383A] dark:bg-[#1C1C1E] overflow-hidden">
        
        {/* header */}
        <div className="flex items-start justify-between border-b border-[#E8E8ED] px-5 py-4 dark:border-[#2C2C2E]">
          <div>
            <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Allocate Product
            </h3>
            <p className="mt-0.5 text-xs text-[#6E6E73]">
              Allocate stock from Shop inventory to a salesperson.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="ml-3 rounded-lg p-1 text-[#86868B] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] dark:hover:bg-[#2C2C2E]"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* form body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-[#FF3B30]/20 bg-[#FFECEB] p-3 text-xs text-[#CC2B22] dark:border-[#FF453A]/20 dark:bg-[#2E0A09] dark:text-[#FF453A]">
              <AlertTriangleIcon size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isLoadingInitial ? (
            <div className="py-8 text-center text-xs text-[#86868B]">Loading options…</div>
          ) : (
            <>
              {/* 1. Salesperson Selector */}
              <Select
                label="Salesperson *"
                value={selectedSalespersonId}
                onChange={(val) => setSelectedSalespersonId(val)}
                options={users.map((u) => ({
                  value: u.id,
                  label: `${u.name} (${u.email})`,
                }))}
                placeholder="Select salesperson…"
              />

              {/* 2. Product Selector (ALWAYS VISIBLE) */}
              <Select
                label="Product *"
                value={selectedProductId}
                onChange={(val) => setSelectedProductId(val)}
                disabled={allocatableProducts.length === 0}
                placeholder={
                  allocatableProducts.length === 0
                    ? 'No allocatable products available'
                    : 'Select product to allocate…'
                }
                options={allocatableProducts.map((p) => ({
                  value: p.id,
                  label: `${p.name}${p.brand ? ` (${p.brand})` : ''} — Cat: ${p.category?.name ?? 'General'}`,
                }))}
              />

              {/* Notice if no allocatable products exist */}
              {allocatableProducts.length === 0 && (
                <div className="rounded-xl border border-[#FF9F0A]/30 bg-[#FFF9F0] p-3 text-xs text-[#9E6200] dark:border-[#FF9F0A]/20 dark:bg-[#2E1F0A] dark:text-[#FF9F0A]">
                  No allocatable products available. Enable product allocation on a category in <strong>Manage Categories</strong> to allocate products here.
                </div>
              )}

              {/* 3. Available SHOP Stock Display */}
              {selectedProduct && (
                <div className="flex items-center justify-between rounded-xl border border-[#D2D2D7] bg-[#F5F5F7] px-3.5 py-2.5 dark:border-[#38383A] dark:bg-[#2C2C2E]">
                  <span className="text-xs text-[#6E6E73] dark:text-[#86868B]">Current Shop Stock</span>
                  <span
                    className={`text-xs font-bold ${
                      shopAvailable > 0
                        ? 'text-[#34C759] dark:text-[#30D158]'
                        : 'text-[#FF3B30] dark:text-[#FF453A]'
                    }`}
                  >
                    Available in Shop: {shopAvailable}
                  </span>
                </div>
              )}

              {/* 4. Quantity Input */}
              <div>
                <Input
                  label={`Quantity to Allocate * ${selectedProduct ? `(max ${shopAvailable} available)` : ''}`}
                  type="number"
                  min={1}
                  max={shopAvailable || 1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={!selectedProductId || shopAvailable < 1}
                  required
                />
                {!isNaN(numQuantity) && numQuantity > shopAvailable && shopAvailable > 0 && (
                  <p className="mt-1 text-[11px] font-medium text-[#FF3B30] dark:text-[#FF453A]">
                    Cannot exceed available shop stock ({shopAvailable}).
                  </p>
                )}
                {selectedProduct && shopAvailable === 0 && (
                  <p className="mt-1 text-[11px] font-medium text-[#FF3B30] dark:text-[#FF453A]">
                    This product has no available stock in Shop. Transfer stock to Shop first.
                  </p>
                )}
              </div>

              {/* 5. Allocation Note */}
              <div>
                <label className="block text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">
                  Allocation Note <span className="text-[#86868B]">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3 py-2 text-xs text-[#1D1D1F] placeholder:text-[#86868B] focus:border-[#0071E3] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 dark:border-[#38383A] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]"
                  placeholder="e.g. Allocated for daily sales"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </>
          )}

          {/* 6. Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8E8ED] dark:border-[#2C2C2E]">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              isLoading={isSubmitting}
              disabled={
                isLoadingInitial ||
                allocatableProducts.length === 0 ||
                !selectedSalespersonId ||
                !selectedProductId ||
                !isQuantityValid ||
                shopAvailable < 1
              }
            >
              Allocate Product
            </Button>
          </div>
        </form>

      </div>
    </div>
  );
};
