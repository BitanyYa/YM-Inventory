'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  InventoryProductItem,
  Location,
  ProductItem,
  ProductUnitItem,
  ReturnStockRequest,
  TrackingType,
} from '../../types/api';
import { inventoryService } from '../../services/inventory.service';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { CloseIcon, SearchIcon } from '../ui/Icons';

interface Props {
  isOpen: boolean;
  /** Pre-selected product (from row action). When null, shows product-search step first. */
  product: InventoryProductItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

const unitBtnCls = (sel: boolean) =>
  `flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
    sel
      ? 'border-[#0071E3] bg-[#0071E3] text-white font-medium'
      : 'border-[#D2D2D7] bg-white text-[#1D1D1F] hover:border-[#0071E3]/40 dark:border-[#38383A] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]'
  }`;

const toggleBtnCls = (active: boolean) =>
  `flex-1 rounded-xl border py-2 text-xs font-semibold transition-colors ${
    active
      ? 'border-[#0071E3] bg-[#0071E3] text-white shadow-xs'
      : 'border-[#D2D2D7] bg-white text-[#1D1D1F] hover:border-[#0071E3]/40 dark:border-[#38383A] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]'
  }`;

function trackingLabel(t: TrackingType) {
  return t === 'SERIALIZED' ? 'Serialized' : 'Quantity';
}

export const ReturnStockModal: React.FC<Props> = ({
  isOpen,
  product: preselectedProduct,
  onClose,
  onSuccess,
}) => {
  /* ── phase management ── */
  const needsSelection = preselectedProduct === null;
  const [phase, setPhase] = useState<'select' | 'return'>(
    needsSelection ? 'select' : 'return',
  );

  /* ── selected product ── */
  const [selectedProduct, setSelectedProduct] = useState<
    ProductItem | InventoryProductItem | null
  >(preselectedProduct);

  /* ── product search (phase 1) ── */
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<InventoryProductItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* ── return form state (phase 2) ── */
  const [quantity, setQuantity] = useState('');
  const [returnLocation, setReturnLocation] = useState<Location>('WAREHOUSE');
  const [note, setNote] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [soldUnits, setSoldUnits] = useState<ProductUnitItem[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── sync state when props change ── */
  useEffect(() => {
    if (isOpen) {
      if (preselectedProduct) {
        setSelectedProduct(preselectedProduct);
        setPhase('return');
      } else {
        setSelectedProduct(null);
        setPhase('select');
        setSearchQuery('');
        setDebouncedQuery('');
        setSearchResults([]);
      }
      setQuantity('');
      setReturnLocation('WAREHOUSE');
      setNote('');
      setSelectedIds([]);
      setSoldUnits([]);
      setError(null);
    }
  }, [isOpen, preselectedProduct]);

  /* ── focus search input when entering select phase ── */
  useEffect(() => {
    if (isOpen && phase === 'select') {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen, phase]);

  /* ── debounce search ── */
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  /* ── search products from inventory endpoint ── */
  const runProductSearch = useCallback(async (query: string) => {
    setIsSearching(true);
    try {
      const res = await inventoryService.getInventory({
        search: query,
        limit: 15,
        isActive: true,
      });
      setSearchResults(res.data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (phase === 'select' && isOpen) {
      runProductSearch(debouncedQuery);
    }
  }, [phase, isOpen, debouncedQuery, runProductSearch]);

  /* ── load sold units when product is serialized ── */
  const isSerialized = selectedProduct?.trackingType === 'SERIALIZED';

  useEffect(() => {
    if (!isOpen || phase !== 'return' || !selectedProduct || !isSerialized) return;
    setLoadingUnits(true);
    setSelectedIds([]);
    inventoryService
      .getProductInventoryDetail(selectedProduct.id)
      .then((res) => {
        const sold = (res.data.units ?? []).filter((u) => u.status === 'SOLD');
        setSoldUnits(sold);
      })
      .catch(() => setSoldUnits([]))
      .finally(() => setLoadingUnits(false));
  }, [isOpen, phase, selectedProduct, isSerialized]);

  if (!isOpen) return null;

  /* ── reset & close ── */
  const resetForm = () => {
    setQuantity('');
    setReturnLocation('WAREHOUSE');
    setNote('');
    setSelectedIds([]);
    setSoldUnits([]);
    setError(null);
    setSearchQuery('');
    setDebouncedQuery('');
    setSearchResults([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSelectProduct = (p: InventoryProductItem) => {
    setSelectedProduct(p);
    setPhase('return');
    setError(null);
  };

  const toggleUnit = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  /* ── stock quantities ── */
  const shopQty =
    selectedProduct && 'inventory' in selectedProduct
      ? selectedProduct.inventory.shopQuantity
      : 0;

  const whQty =
    selectedProduct && 'inventory' in selectedProduct
      ? selectedProduct.inventory.warehouseQuantity
      : 0;

  /* ── submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedProduct) return;

    const payload: ReturnStockRequest = {
      productId: selectedProduct.id,
      location: returnLocation,
    };

    if (isSerialized) {
      if (!selectedIds.length) {
        setError('Select at least one sold unit to return.');
        return;
      }
      payload.unitIds = selectedIds;
    } else {
      const qty = parseInt(quantity, 10);
      if (!qty || qty < 1) {
        setError('Quantity must be at least 1.');
        return;
      }
      payload.quantity = qty;
    }

    if (note.trim()) {
      payload.note = note.trim();
    }

    setIsLoading(true);
    try {
      await inventoryService.returnStock(payload);
      resetForm();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(
        (err as { message?: string })?.message || 'Failed to process return.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      {/* backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={handleClose}
      />

      {/* modal container */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#D2D2D7] bg-white shadow-xl dark:border-[#38383A] dark:bg-[#1C1C1E]">
        {/* modal header */}
        <div className="flex items-start justify-between border-b border-[#E8E8ED] px-5 py-4 dark:border-[#2C2C2E]">
          <div>
            <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Return Stock
            </h3>
            <p className="text-xs text-[#6E6E73]">
              {phase === 'select'
                ? 'Search and select a product to process return'
                : selectedProduct?.name}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="ml-4 rounded-lg p-1 text-[#86868B] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] dark:hover:bg-[#2C2C2E] dark:hover:text-[#F5F5F7]"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* error message banner */}
        {error && (
          <div className="mx-5 mt-4 rounded-xl border border-[#FF3B30]/20 bg-[#FFECEB] px-3.5 py-2.5 text-xs font-medium text-[#CC2B22] dark:border-[#FF453A]/20 dark:bg-[#2E0A09] dark:text-[#FF453A]">
            {error}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* PHASE 1: SEARCH & SELECT PRODUCT */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {phase === 'select' && (
          <div className="p-5 space-y-3">
            <div className="relative">
              <SearchIcon
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B]"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by name or brand…"
                className="w-full rounded-xl border border-[#D2D2D7] bg-[#F5F5F7] py-2 pl-9 pr-3 text-xs text-[#1D1D1F] placeholder:text-[#AEAEB2] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/50 focus:border-[#0071E3] dark:border-[#38383A] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pt-1">
              {isSearching ? (
                <div className="flex justify-center py-6">
                  <Spinner size="md" />
                </div>
              ) : searchResults.length === 0 ? (
                <p className="py-6 text-center text-xs text-[#86868B]">
                  {debouncedQuery
                    ? 'No products match your search.'
                    : 'Type to search products in catalog.'}
                </p>
              ) : (
                searchResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectProduct(item)}
                    className="flex w-full items-center justify-between rounded-xl border border-[#E8E8ED] bg-white p-3 text-left transition-colors hover:border-[#0071E3]/40 hover:bg-[#F5F5F7] dark:border-[#38383A] dark:bg-[#1C1C1E] dark:hover:bg-[#2C2C2E]"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <span className="block truncate text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {item.name}
                      </span>
                      <span className="block text-[11px] text-[#86868B]">
                        {[item.brand, item.category?.name].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge
                        variant={item.trackingType === 'SERIALIZED' ? 'info' : 'neutral'}
                        size="sm"
                      >
                        {trackingLabel(item.trackingType)}
                      </Badge>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#E8E8ED] dark:border-[#2C2C2E]">
              <Button variant="secondary" size="sm" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* PHASE 2: RETURN FORM */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {phase === 'return' && selectedProduct && (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            {/* Compact Product & Inventory Summary */}
            <div className="rounded-xl border border-[#E8E8ED] bg-[#F5F5F7] p-3 text-xs dark:border-[#2C2C2E] dark:bg-[#2C2C2E]">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {selectedProduct.name}
                  </h4>
                  <p className="text-[11px] text-[#86868B]">
                    {[
                      selectedProduct.brand,
                      selectedProduct.category?.name,
                      trackingLabel(selectedProduct.trackingType),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                {needsSelection && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhase('select');
                      setError(null);
                    }}
                    className="text-[11px] font-semibold text-[#0071E3] hover:underline"
                  >
                    Change
                  </button>
                )}
              </div>

              <div className="mt-2 flex items-center gap-4 text-xs pt-1 border-t border-[#D2D2D7]/40 dark:border-[#38383A]">
                <span className="text-[#6E6E73]">
                  Warehouse: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{whQty}</strong>
                </span>
                <span className="text-[#D2D2D7]">|</span>
                <span className="text-[#6E6E73]">
                  Shop: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{shopQty}</strong>
                </span>
              </div>
            </div>

            {/* Return Destination Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#86868B]">
                Return Destination *
              </label>
              <div className="flex gap-2">
                {(['WAREHOUSE', 'SHOP'] as Location[]).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setReturnLocation(loc)}
                    className={toggleBtnCls(returnLocation === loc)}
                  >
                    Return to {loc === 'WAREHOUSE' ? 'Warehouse' : 'Shop'}
                  </button>
                ))}
              </div>
            </div>

            {/* QUANTITY TRACKED FORM */}
            {!isSerialized ? (
              <Input
                label="Quantity to return *"
                type="number"
                min={1}
                placeholder="e.g. 1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            ) : loadingUnits ? (
              /* SERIALIZED TRACKED FORM */
              <div className="flex justify-center py-6">
                <Spinner size="md" />
              </div>
            ) : soldUnits.length === 0 ? (
              <div className="rounded-xl border border-[#FF9F0A]/30 bg-[#FFF4E0] p-3 text-xs text-[#995E00]">
                No sold units found for this product in history.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#86868B]">
                    Select sold units ({selectedIds.length}/{soldUnits.length})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedIds(
                        selectedIds.length === soldUnits.length
                          ? []
                          : soldUnits.map((u) => u.id),
                      )
                    }
                    className="text-xs font-semibold text-[#0071E3] hover:text-[#0077ED]"
                  >
                    {selectedIds.length === soldUnits.length
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-0.5">
                  {soldUnits.map((unit) => {
                    const sel = selectedIds.includes(unit.id);
                    return (
                      <button
                        key={unit.id}
                        type="button"
                        onClick={() => toggleUnit(unit.id)}
                        className={unitBtnCls(sel)}
                      >
                        <span
                          className={`h-3.5 w-3.5 shrink-0 rounded border transition-colors ${
                            sel
                              ? 'border-white bg-white'
                              : 'border-[#D2D2D7] dark:border-[#38383A]'
                          }`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">
                            {unit.imei ?? unit.serialNumber ?? unit.id.slice(0, 8)}
                          </span>
                          {(unit.storage || unit.color) && (
                            <span
                              className={`block text-[11px] ${
                                sel ? 'opacity-85' : 'text-[#86868B]'
                              }`}
                            >
                              {[unit.storage ? `${unit.storage}GB` : null, unit.color]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Note / Return Reason Input */}
            <div>
              <label className="block text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">
                Return reason / Note (Optional)
              </label>
              <textarea
                rows={2}
                className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3 py-2 text-xs text-[#1D1D1F] placeholder:text-[#AEAEB2] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/50 focus:border-[#0071E3] dark:border-[#38383A] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]"
                placeholder="e.g. Customer returned item due to change of mind"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8E8ED] dark:border-[#2C2C2E]">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancel
              </Button>

              <Button
                variant="primary"
                size="sm"
                type="submit"
                isLoading={isLoading}
                disabled={
                  (isSerialized && soldUnits.length === 0) ||
                  (isSerialized && selectedIds.length === 0)
                }
              >
                {isLoading ? 'Processing...' : 'Process Return'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
