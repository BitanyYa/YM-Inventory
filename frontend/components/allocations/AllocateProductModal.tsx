'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { InventoryProductItem, Salesperson } from '../../types/api';
import { salespeopleService } from '../../services/salespeople.service';
import { salespersonStockService } from '../../services/salesperson-stock.service';
import { inventoryService, invalidateInventoryCache } from '../../services/inventory.service';
import { categoryService } from '../../services/category.service';
import { productService } from '../../services/product.service';
import { CreateSalespersonModal } from '../salespeople/CreateSalespersonModal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Spinner } from '../ui/Spinner';
import {
  AlertTriangleIcon,
  CloseIcon,
  PlusIcon,
  SearchIcon,
  UserIcon,
} from '../ui/Icons';

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
  // Salesperson State
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [selectedSalesperson, setSelectedSalesperson] = useState<Salesperson | null>(null);
  const [salespersonSearchText, setSalespersonSearchText] = useState<string>('');
  const [isSearchingSalespeople, setIsSearchingSalespeople] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [isCreateSalespersonModalOpen, setIsCreateSalespersonModalOpen] = useState<boolean>(false);

  // Product & Allocation State
  const [allocatableProducts, setAllocatableProducts] = useState<InventoryProductItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [note, setNote] = useState<string>('');

  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch active salespeople with search
  const fetchActiveSalespeople = useCallback(async (searchQuery?: string) => {
    setIsSearchingSalespeople(true);
    try {
      const data = await salespeopleService.getSalespeople({
        search: searchQuery?.trim() || undefined,
      });
      setSalespeople(data || []);
    } catch (err) {
      console.error('Failed to load active salespeople:', err);
    } finally {
      setIsSearchingSalespeople(false);
    }
  }, []);

  // Search input debounced effect
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      fetchActiveSalespeople(salespersonSearchText);
    }, 200);

    return () => clearTimeout(timer);
  }, [isOpen, salespersonSearchText, fetchActiveSalespeople]);

  // Initial Load (Inventory Products & Categories)
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setIsLoadingInitial(true);
      setError(null);
      try {
        const [inventoryRes, categoriesData] = await Promise.all([
          inventoryService.getInventory({ limit: 100 }),
          categoryService.getCategories(),
        ]);

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

        if (allocatable.length > 0) {
          setSelectedProductId((prev) =>
            allocatable.some((p) => p.id === prev) ? prev : allocatable[0].id,
          );
        } else {
          setSelectedProductId('');
        }
      } catch (err: unknown) {
        setError(
          (err as { message?: string })?.message || 'Failed to load allocation options.',
        );
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
    setSelectedSalesperson(null);
    setSalespersonSearchText('');
    setQuantity('1');
    setNote('');
    setError(null);
    setIsDropdownOpen(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSalespersonCreated = (createdSalesperson?: Salesperson) => {
    setIsCreateSalespersonModalOpen(false);
    fetchActiveSalespeople();
    if (createdSalesperson) {
      setSelectedSalesperson(createdSalesperson);
      setIsDropdownOpen(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSalesperson || !selectedProductId || !isQuantityValid) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await salespersonStockService.allocateProduct({
        productId: selectedProductId,
        salespersonId: selectedSalesperson.id,
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
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

        {/* Modal Window */}
        <div className="relative w-full max-w-md rounded-2xl border border-[#D2D2D7] bg-white shadow-2xl dark:border-[#38383A] dark:bg-[#1C1C1E] overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-[#E8E8ED] px-5 py-4 dark:border-[#2C2C2E]">
            <div>
              <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Allocate Product
              </h3>
              <p className="mt-0.5 text-xs text-[#6E6E73] dark:text-[#86868B]">
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

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-[#FF3B30]/20 bg-[#FFECEB] p-3 text-xs text-[#CC2B22] dark:border-[#FF453A]/20 dark:bg-[#2E0A09] dark:text-[#FF453A]">
                <AlertTriangleIcon size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {isLoadingInitial ? (
              <div className="py-8 text-center text-xs text-[#86868B]">
                Loading allocation options…
              </div>
            ) : (
              <>
                {/* 1. Searchable Salesperson Selector */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                      Salesperson *
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCreateSalespersonModalOpen(true)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#0071E3] hover:underline dark:text-[#2997FF]"
                    >
                      <PlusIcon size={14} />
                      <span>Add Salesperson</span>
                    </button>
                  </div>

                  {selectedSalesperson ? (
                    /* Selected Salesperson Display Card */
                    <div className="flex items-center justify-between rounded-xl border border-[#0071E3]/40 bg-[#0071E3]/5 p-3 dark:border-[#2997FF]/40 dark:bg-[#2997FF]/10">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0071E3]/10 text-[#0071E3] dark:bg-[#2997FF]/20 dark:text-[#2997FF]">
                          <UserIcon size={16} />
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                            {selectedSalesperson.name}
                          </span>
                          {selectedSalesperson.phone && (
                            <span className="block text-[11px] text-[#6E6E73] dark:text-[#86868B]">
                              Phone: {selectedSalesperson.phone}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSalesperson(null);
                          setSalespersonSearchText('');
                          setIsDropdownOpen(true);
                        }}
                        className="rounded-lg p-1 text-[#86868B] hover:bg-[#E8E8ED] hover:text-[#1D1D1F] dark:hover:bg-[#2C2C2E] dark:hover:text-[#F5F5F7]"
                        title="Change salesperson"
                      >
                        <CloseIcon size={16} />
                      </button>
                    </div>
                  ) : (
                    /* Salesperson Search Combobox */
                    <div className="relative">
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#86868B]">
                          <SearchIcon size={15} />
                        </div>
                        <Input
                          type="text"
                          placeholder="Search salesperson by name or phone..."
                          value={salespersonSearchText}
                          onChange={(e) => {
                            setSalespersonSearchText(e.target.value);
                            setIsDropdownOpen(true);
                          }}
                          onFocus={() => setIsDropdownOpen(true)}
                          className="pl-9 pr-8"
                        />
                        {isSearchingSalespeople && (
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                            <Spinner size="sm" className="text-[#0071E3]" />
                          </div>
                        )}
                      </div>

                      {/* Dropdown Options List */}
                      {isDropdownOpen && (
                        <div className="absolute z-[70] mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-[#D2D2D7] bg-white py-1 shadow-lg dark:border-[#38383A] dark:bg-[#1C1C1E]">
                          {salespeople.length === 0 ? (
                            <div className="p-3 text-center text-xs text-[#86868B]">
                              <p className="mb-1">No salespeople available</p>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsDropdownOpen(false);
                                  setIsCreateSalespersonModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 font-semibold text-[#0071E3] hover:underline dark:text-[#2997FF]"
                              >
                                <PlusIcon size={13} />
                                <span>Add Salesperson</span>
                              </button>
                            </div>
                          ) : (
                            salespeople.map((sp) => (
                              <button
                                key={sp.id}
                                type="button"
                                onClick={() => {
                                  setSelectedSalesperson(sp);
                                  setIsDropdownOpen(false);
                                }}
                                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]"
                              >
                                <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                                  {sp.name}
                                </span>
                                {sp.phone && (
                                  <span className="text-[11px] text-[#86868B]">
                                    {sp.phone}
                                  </span>
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Product Selector */}
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
                    <span className="text-xs text-[#6E6E73] dark:text-[#86868B]">
                      Current Shop Stock
                    </span>
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

            {/* Action Buttons */}
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
                  !selectedSalesperson ||
                  allocatableProducts.length === 0 ||
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

      {/* Create Salesperson Sub-Modal */}
      <CreateSalespersonModal
        isOpen={isCreateSalespersonModalOpen}
        onClose={() => setIsCreateSalespersonModalOpen(false)}
        onSuccess={handleSalespersonCreated}
      />
    </>
  );
};
