'use client';

import React, { useEffect, useState } from 'react';
import { Branch, InventoryProductItem } from '../../types/api';
import { branchTransfersService } from '../../services/branch-transfers.service';
import { inventoryService, invalidateInventoryCache } from '../../services/inventory.service';
import { productService } from '../../services/product.service';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { CloseIcon, AlertTriangleIcon, ArrowRightIcon } from '../ui/Icons';

interface TransferToBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const TransferToBranchModal: React.FC<TransferToBranchModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [transferableProducts, setTransferableProducts] = useState<InventoryProductItem[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
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
        const [branchesData, inventoryRes] = await Promise.all([
          branchTransfersService.getBranches(),
          inventoryService.getInventory({ limit: 100 }),
        ]);

        const activeBranches = (branchesData || []).filter((b) => b.isActive);
        setBranches(activeBranches);

        // Filter for active products tracked by QUANTITY
        const eligibleProducts = (inventoryRes.data || []).filter(
          (item) => item.isActive && item.trackingType === 'QUANTITY',
        );

        setTransferableProducts(eligibleProducts);

        if (activeBranches.length > 0) {
          setSelectedBranchId((prev) => (activeBranches.some((b) => b.id === prev) ? prev : activeBranches[0].id));
        } else {
          setSelectedBranchId('');
        }

        if (eligibleProducts.length > 0) {
          setSelectedProductId((prev) => (eligibleProducts.some((p) => p.id === prev) ? prev : eligibleProducts[0].id));
        } else {
          setSelectedProductId('');
        }
      } catch (err: unknown) {
        setError((err as { message?: string })?.message || 'Failed to load transfer options.');
      } finally {
        setIsLoadingInitial(false);
      }
    };

    loadData();
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedBranch = branches.find((b) => b.id === selectedBranchId);
  const selectedProduct = transferableProducts.find((p) => p.id === selectedProductId);
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
    if (!selectedBranchId || !selectedProductId || !isQuantityValid) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await branchTransfersService.transferToBranch({
        branchId: selectedBranchId,
        productId: selectedProductId,
        quantity: numQuantity,
        note: note.trim() || undefined,
      });

      invalidateInventoryCache();
      productService.clearCache();
      resetForm();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to transfer stock to branch.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal Box */}
      <div className="relative w-full max-w-md rounded-2xl border border-[#D2D2D7] bg-white shadow-2xl dark:border-[#38383A] dark:bg-[#1C1C1E] overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#E8E8ED] px-5 py-4 dark:border-[#2C2C2E]">
          <div>
            <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Transfer Stock to Branch
            </h3>
            <p className="mt-0.5 text-xs text-[#6E6E73] dark:text-[#86868B]">
              Transfer stock from Main Shop inventory to a branch.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="ml-3 rounded-lg p-1 text-[#86868B] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] dark:hover:bg-[#2C2C2E]"
            aria-label="Close modal"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Transfer Route Badge */}
        <div className="bg-[#F5F5F7] px-5 py-2.5 border-b border-[#E8E8ED] dark:bg-[#2C2C2E]/60 dark:border-[#38383A] flex items-center justify-between text-xs">
          <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
            Source: <span className="text-[#0071E3] dark:text-[#2997FF]">Main Shop</span>
          </span>
          <ArrowRightIcon size={14} className="text-[#86868B]" />
          <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
            Target: <span className="text-[#34C759] dark:text-[#30D158]">{selectedBranch?.name || 'Select Branch'}</span>
          </span>
        </div>

        {/* Form Body */}
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
              {/* 1. Destination Branch Selector */}
              <Select
                label="Destination Branch *"
                value={selectedBranchId}
                onChange={(val) => setSelectedBranchId(val)}
                options={branches.map((b) => ({
                  value: b.id,
                  label: b.name,
                }))}
                placeholder="Select target branch…"
              />

              {/* 2. Product Selector (ALWAYS VISIBLE) */}
              <Select
                label="Product *"
                value={selectedProductId}
                onChange={(val) => setSelectedProductId(val)}
                disabled={transferableProducts.length === 0}
                placeholder={
                  transferableProducts.length === 0
                    ? 'No transferable products available'
                    : 'Select product to transfer…'
                }
                options={transferableProducts.map((p) => ({
                  value: p.id,
                  label: `${p.name}${p.brand ? ` (${p.brand})` : ''} — Cat: ${p.category?.name ?? 'General'}`,
                }))}
              />

              {/* Notice if no eligible products exist */}
              {transferableProducts.length === 0 && (
                <div className="rounded-xl border border-[#FF9F0A]/30 bg-[#FFF9F0] p-3 text-xs text-[#9E6200] dark:border-[#FF9F0A]/20 dark:bg-[#2E1F0A] dark:text-[#FF9F0A]">
                  No transferable products available. Ensure active QUANTITY-tracked products exist in inventory.
                </div>
              )}

              {/* 3. Available Main Shop Stock Display */}
              {selectedProduct && (
                <div className="flex items-center justify-between rounded-xl border border-[#D2D2D7] bg-[#F5F5F7] px-3.5 py-2.5 dark:border-[#38383A] dark:bg-[#2C2C2E]">
                  <span className="text-xs text-[#6E6E73] dark:text-[#86868B]">Current Main Shop Stock</span>
                  <span
                    className={`text-xs font-bold ${
                      shopAvailable > 0
                        ? 'text-[#34C759] dark:text-[#30D158]'
                        : 'text-[#FF3B30] dark:text-[#FF453A]'
                    }`}
                  >
                    Available in Main Shop: {shopAvailable}
                  </span>
                </div>
              )}

              {/* 4. Quantity Input */}
              <div>
                <Input
                  label={`Quantity to Transfer * ${selectedProduct ? `(max ${shopAvailable} available)` : ''}`}
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
                    Cannot exceed available Main Shop stock ({shopAvailable}).
                  </p>
                )}
                {selectedProduct && shopAvailable === 0 && (
                  <p className="mt-1 text-[11px] font-medium text-[#FF3B30] dark:text-[#FF453A]">
                    This product has no available stock in Main Shop. Transfer stock to Shop first.
                  </p>
                )}
              </div>

              {/* 5. Transfer Note */}
              <div>
                <label className="block text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">
                  Transfer Note <span className="text-[#86868B]">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3 py-2 text-xs text-[#1D1D1F] placeholder:text-[#86868B] focus:border-[#0071E3] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 dark:border-[#38383A] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]"
                  placeholder="e.g. Initial branch stock setup"
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
                branches.length === 0 ||
                transferableProducts.length === 0 ||
                !selectedBranchId ||
                !selectedProductId ||
                !isQuantityValid ||
                shopAvailable < 1
              }
            >
              Transfer Stock
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
