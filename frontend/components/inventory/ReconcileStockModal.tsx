'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  InventoryProductItem,
  Location,
  ProductDetail,
  ProductItem,
  ProductUnitItem,
  ReconcileStockRequest,
  TrackingType,
} from '../../types/api';
import { inventoryService } from '../../services/inventory.service';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { CloseIcon, SearchIcon } from '../ui/Icons';

interface ReconcileStockModalProps {
  isOpen: boolean;
  /** Pre-selected product (from row action). When null, shows product-search step first. */
  product: InventoryProductItem | null;
  onClose: () => void;
  onSuccess: (message?: string) => void;
}

export const ReconcileStockModal: React.FC<ReconcileStockModalProps> = ({
  isOpen,
  product: preselectedProduct,
  onClose,
  onSuccess,
}) => {
  /* ── phase management ── */
  const needsSelection = preselectedProduct === null;
  const [phase, setPhase] = useState<'select' | 'form'>(
    needsSelection ? 'select' : 'form',
  );

  /* ── selected product state ── */
  const [selectedProduct, setSelectedProduct] = useState<
    ProductItem | InventoryProductItem | null
  >(preselectedProduct);

  /* ── mode B search state ── */
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<InventoryProductItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* ── form state ── */
  const [location, setLocation] = useState<Location>('WAREHOUSE');
  const [physicalCountStr, setPhysicalCountStr] = useState<string>('');
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── serialized units state ── */
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [verifiedUnitIds, setVerifiedUnitIds] = useState<Set<string>>(new Set());

  /* ── debounce search input ── */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  /* ── reset & sync state when modal opens/closes or props change ── */
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setLocation('WAREHOUSE');
      setNote('');
      setPhysicalCountStr('');
      setVerifiedUnitIds(new Set());
      setProductDetail(null);

      if (preselectedProduct) {
        setSelectedProduct(preselectedProduct);
        setPhase('form');
        // prefill default count for quantity product
        if (preselectedProduct.trackingType === 'QUANTITY') {
          setPhysicalCountStr(preselectedProduct.inventory.warehouseQuantity.toString());
        }
      } else {
        setSelectedProduct(null);
        setPhase('select');
        setSearchQuery('');
        setDebouncedQuery('');
        setSearchResults([]);
      }
    }
  }, [isOpen, preselectedProduct]);

  /* ── perform search for Mode B ── */
  const executeSearch = useCallback(async () => {
    if (!debouncedQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await inventoryService.getInventory({
        search: debouncedQuery.trim(),
        limit: 10,
        isActive: true,
      });
      setSearchResults(res.data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    if (phase === 'select' && isOpen) {
      executeSearch();
    }
  }, [phase, isOpen, executeSearch]);

  /* ── focus search input when entering select phase ── */
  useEffect(() => {
    if (phase === 'select' && isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [phase, isOpen]);

  /* ── load product details & units for SERIALIZED products ── */
  const fetchProductUnits = useCallback(async (prodId: string) => {
    setLoadingDetail(true);
    try {
      const res = await inventoryService.getProductInventoryDetail(prodId);
      setProductDetail(res.data);

      // Pre-select active units at current location by default
      const activeStatus = location === 'WAREHOUSE' ? 'AVAILABLE' : 'IN_SHOP';
      const activeUnitsAtLoc = (res.data.units || []).filter(
        (u) => u.location === location && u.status === activeStatus,
      );
      setVerifiedUnitIds(new Set(activeUnitsAtLoc.map((u) => u.id)));
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to load product unit details.');
    } finally {
      setLoadingDetail(false);
    }
  }, [location]);

  useEffect(() => {
    if (phase === 'form' && selectedProduct && selectedProduct.trackingType === 'SERIALIZED') {
      fetchProductUnits(selectedProduct.id);
    }
  }, [phase, selectedProduct, location, fetchProductUnits]);

  /* ── handle location tab switch in form ── */
  const handleLocationChange = (newLoc: Location) => {
    setLocation(newLoc);
    setError(null);

    if (selectedProduct && selectedProduct.trackingType === 'QUANTITY') {
      const qty = newLoc === 'WAREHOUSE'
        ? selectedProduct.inventory.warehouseQuantity
        : selectedProduct.inventory.shopQuantity;
      setPhysicalCountStr(qty.toString());
    }
  };

  /* ── handle product selection from search results ── */
  const handleSelectProduct = (p: InventoryProductItem) => {
    setSelectedProduct(p);
    setError(null);
    setPhase('form');
    if (p.trackingType === 'QUANTITY') {
      setPhysicalCountStr(p.inventory.warehouseQuantity.toString());
    }
  };

  /* ── compute current system quantity for quantity products ── */
  const currentSystemQty = selectedProduct
    ? (location === 'WAREHOUSE'
        ? selectedProduct.inventory.warehouseQuantity
        : selectedProduct.inventory.shopQuantity)
    : 0;

  const parsedPhysicalCount = physicalCountStr === '' ? NaN : parseInt(physicalCountStr, 10);
  const isValidPhysicalCount = !isNaN(parsedPhysicalCount) && parsedPhysicalCount >= 0;
  const qtyDifference = isValidPhysicalCount ? parsedPhysicalCount - currentSystemQty : 0;

  /* ── compute serialized unit calculations ── */
  const activeStatus = location === 'WAREHOUSE' ? 'AVAILABLE' : 'IN_SHOP';
  const unitsForLocation = (productDetail?.units || []).filter(
    (u) => u.location === location && (u.status === activeStatus || u.status === 'UNACCOUNTED'),
  );

  const activeUnitsForLocation = unitsForLocation.filter((u) => u.status === activeStatus);
  const unaccountedUnitsForLocation = unitsForLocation.filter((u) => u.status === 'UNACCOUNTED');

  const missingUnits = activeUnitsForLocation.filter((u) => !verifiedUnitIds.has(u.id));
  const restoredUnits = unaccountedUnitsForLocation.filter((u) => verifiedUnitIds.has(u.id));

  const serializedPreviousQty = activeUnitsForLocation.length;
  const serializedVerifiedCount = verifiedUnitIds.size;
  const serializedDifference = serializedVerifiedCount - serializedPreviousQty;

  const isSerializedChanged = missingUnits.length > 0 || restoredUnits.length > 0;

  /* ── handle select all / clear all for serialized units ── */
  const handleSelectAllUnits = () => {
    setVerifiedUnitIds(new Set(unitsForLocation.map((u) => u.id)));
  };

  const handleClearAllUnits = () => {
    setVerifiedUnitIds(new Set());
  };

  const toggleUnitVerification = (unitId: string) => {
    setVerifiedUnitIds((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };

  /* ── submit handler ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setError(null);

    const isQuantity = selectedProduct.trackingType === 'QUANTITY';

    if (isQuantity) {
      if (!isValidPhysicalCount) {
        setError('Physical count must be a non-negative integer.');
        return;
      }
      if (qtyDifference === 0) return; // No adjustment needed
    } else {
      if (!isSerializedChanged) return; // No adjustment needed
    }

    setIsLoading(true);

    try {
      const payload: ReconcileStockRequest = {
        productId: selectedProduct.id,
        location,
        note: note.trim() || undefined,
      };

      if (isQuantity) {
        payload.actualCount = parsedPhysicalCount;
      } else {
        payload.verifiedUnitIds = Array.from(verifiedUnitIds);
      }

      const res = await inventoryService.reconcileStock(payload);
      onSuccess(res.message);
      onClose();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Reconciliation failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* modal window */}
      <div className="relative w-full max-w-lg rounded-2xl border border-[#D2D2D7] bg-white shadow-2xl dark:border-[#38383A] dark:bg-[#1C1C1E] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* modal header */}
        <div className="flex items-center justify-between border-b border-[#E8E8ED] px-4 py-3 dark:border-[#2C2C2E]">
          <div>
            <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Reconcile Stock Audit
            </h3>
            <p className="text-[11px] text-[#6E6E73]">
              {phase === 'select'
                ? 'Select a product to perform physical inventory audit reconciliation'
                : `Adjust system counts for ${selectedProduct?.name}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[#86868B] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] dark:hover:bg-[#2C2C2E]"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* PHASE 1: MODE B — PRODUCT SEARCH                                 */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {phase === 'select' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="relative">
              <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#AEAEB2]" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search product name or brand…"
                className="w-full rounded-xl border border-[#D2D2D7] bg-[#F5F5F7] py-2 pl-9 pr-3 text-xs text-[#1D1D1F] placeholder:text-[#AEAEB2] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/50 focus:border-[#0071E3] dark:border-[#38383A] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]"
              />
            </div>

            {isSearching ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="md" className="text-[#0071E3]" />
              </div>
            ) : searchResults.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#6E6E73]">
                {debouncedQuery ? 'No matching active products found.' : 'Type to search products for reconciliation.'}
              </div>
            ) : (
              <div className="divide-y divide-[#E8E8ED] rounded-xl border border-[#E8E8ED] bg-white dark:divide-[#2C2C2E] dark:border-[#38383A] dark:bg-[#1C1C1E]">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectProduct(p)}
                    className="flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {p.name}
                        </span>
                        <Badge variant={p.trackingType === 'SERIALIZED' ? 'info' : 'neutral'} size="sm">
                          {p.trackingType === 'SERIALIZED' ? 'Serial' : 'Qty'}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#86868B]">
                        {[p.brand, p.category?.name].filter(Boolean).join(' · ')}
                      </p>
                    </div>

                    <div className="shrink-0 text-right text-[11px] text-[#6E6E73]">
                      <div>WH: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{p.inventory.warehouseQuantity}</strong></div>
                      <div>Shop: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{p.inventory.shopQuantity}</strong></div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* PHASE 2: RECONCILIATION FORM                                      */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {phase === 'form' && selectedProduct && (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* error banner */}
            {error && (
              <div className="rounded-xl border border-[#FF3B30]/20 bg-[#FFECEB] p-3 text-xs text-[#CC2B22] dark:border-[#FF453A]/20 dark:bg-[#2E0A09] dark:text-[#FF453A]">
                {error}
              </div>
            )}

            {/* compact product summary header */}
            <div className="flex items-center justify-between rounded-xl border border-[#E8E8ED] bg-[#F5F5F7] p-3 dark:border-[#2C2C2E] dark:bg-[#2C2C2E]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {selectedProduct.name}
                  </span>
                  <Badge variant={selectedProduct.trackingType === 'SERIALIZED' ? 'info' : 'neutral'} size="sm">
                    {selectedProduct.trackingType === 'SERIALIZED' ? 'Serialized' : 'Quantity'}
                  </Badge>
                </div>
                <p className="mt-0.5 text-[11px] text-[#86868B]">
                  {[selectedProduct.brand, selectedProduct.category?.name].filter(Boolean).join(' · ')}
                </p>
              </div>

              {needsSelection && (
                <button
                  type="button"
                  onClick={() => setPhase('select')}
                  className="text-xs text-[#0071E3] hover:underline font-medium"
                >
                  Change
                </button>
              )}
            </div>

            {/* location segmented control */}
            <div>
              <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1.5">
                Audited Location
              </label>
              <div className="flex rounded-xl border border-[#E8E8ED] bg-[#F5F5F7] p-1 dark:border-[#38383A] dark:bg-[#2C2C2E]">
                {(['WAREHOUSE', 'SHOP'] as Location[]).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => handleLocationChange(loc)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                      location === loc
                        ? 'bg-white text-[#1D1D1F] shadow-xs dark:bg-[#1C1C1E] dark:text-[#F5F5F7]'
                        : 'text-[#6E6E73] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'
                    }`}
                  >
                    {loc === 'WAREHOUSE' ? 'Warehouse' : 'Shop'}
                  </button>
                ))}
              </div>
            </div>

            {/* ────────────────────────────────────────────────────────────── */}
            {/* QUANTITY PRODUCT WORKFLOW                                      */}
            {/* ────────────────────────────────────────────────────────────── */}
            {selectedProduct.trackingType === 'QUANTITY' && (
              <div className="space-y-3">
                
                {/* physical count input */}
                <div>
                  <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">
                    Physical Count *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={physicalCountStr}
                    onChange={(e) => setPhysicalCountStr(e.target.value)}
                    placeholder="Enter verified physical count"
                    required
                  />
                </div>

                {/* compact discrepancy calculation strip */}
                <div className="flex items-center justify-between rounded-xl border border-[#E8E8ED] bg-white p-3 text-xs dark:border-[#38383A] dark:bg-[#1C1C1E]">
                  <div>
                    <span className="text-[#86868B] block text-[11px]">System Quantity</span>
                    <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {currentSystemQty}
                    </span>
                  </div>

                  <div className="text-center">
                    <span className="text-[#86868B] block text-[11px]">Physical Count</span>
                    <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {isValidPhysicalCount ? parsedPhysicalCount : '—'}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[#86868B] block text-[11px]">Discrepancy</span>
                    {isValidPhysicalCount ? (
                      qtyDifference === 0 ? (
                        <Badge variant="neutral" size="sm">0 (Matches)</Badge>
                      ) : qtyDifference > 0 ? (
                        <Badge variant="success" size="sm">+{qtyDifference} Surplus</Badge>
                      ) : (
                        <Badge variant="danger" size="sm">{qtyDifference} Shortage</Badge>
                      )
                    ) : (
                      <span className="text-[#86868B]">—</span>
                    )}
                  </div>
                </div>

                {/* confirmation callout if non-zero difference */}
                {isValidPhysicalCount && qtyDifference !== 0 && (
                  <div className={`rounded-xl border p-3 text-xs ${
                    qtyDifference > 0
                      ? 'border-[#30D158]/30 bg-[#E9F9EE] text-[#1A7A3A] dark:border-[#30D158]/20 dark:bg-[#0A2E1A] dark:text-[#30D158]'
                      : 'border-[#FF3B30]/20 bg-[#FFECEB] text-[#CC2B22] dark:border-[#FF453A]/20 dark:bg-[#2E0A09] dark:text-[#FF453A]'
                  }`}>
                    <div className="font-semibold mb-0.5">Audit Discrepancy Summary</div>
                    <div>
                      System stock: <strong>{currentSystemQty}</strong> → Physical count: <strong>{parsedPhysicalCount}</strong> (Adjustment: <strong>{qtyDifference > 0 ? `+${qtyDifference}` : qtyDifference}</strong>)
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ────────────────────────────────────────────────────────────── */}
            {/* SERIALIZED PRODUCT WORKFLOW                                    */}
            {/* ────────────────────────────────────────────────────────────── */}
            {selectedProduct.trackingType === 'SERIALIZED' && (
              <div className="space-y-3">
                {loadingDetail ? (
                  <div className="flex items-center justify-center py-8">
                    <Spinner size="md" className="text-[#0071E3]" />
                  </div>
                ) : (
                  <>
                    {/* summary counters */}
                    <div className="flex items-center justify-between rounded-xl border border-[#E8E8ED] bg-[#F5F5F7] px-3 py-2 text-xs dark:border-[#38383A] dark:bg-[#2C2C2E]">
                      <span className="text-[#6E6E73]">
                        System units: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{serializedPreviousQty}</strong>
                      </span>
                      <span className="text-[#6E6E73]">
                        Verified: <strong className="text-[#0071E3] font-bold">{serializedVerifiedCount}</strong>
                      </span>
                      <span className="text-[#6E6E73]">
                        Unverified: <strong className="text-[#FF3B30] font-bold">{missingUnits.length}</strong>
                      </span>
                    </div>

                    {/* selection toolbar */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        Verified Physical Units
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAllUnits}
                          className="text-[11px] font-medium text-[#0071E3] hover:underline"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={handleClearAllUnits}
                          className="text-[11px] font-medium text-[#6E6E73] hover:underline"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    {/* unit list with checkboxes */}
                    {unitsForLocation.length === 0 ? (
                      <div className="rounded-xl border border-[#E8E8ED] p-4 text-center text-xs text-[#6E6E73] dark:border-[#38383A]">
                        No active or unaccounted units currently at {location.toLowerCase()}.
                      </div>
                    ) : (
                      <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                        {unitsForLocation.map((unit) => {
                          const isVerified = verifiedUnitIds.has(unit.id);
                          const isUnaccounted = unit.status === 'UNACCOUNTED';

                          return (
                            <label
                              key={unit.id}
                              className={`flex items-center justify-between rounded-xl border p-2.5 text-xs transition-colors cursor-pointer ${
                                isVerified
                                  ? 'border-[#0071E3]/40 bg-[#0071E3]/5 dark:border-[#0071E3]/50 dark:bg-[#0071E3]/10'
                                  : 'border-[#E8E8ED] bg-white hover:border-[#D2D2D7] dark:border-[#38383A] dark:bg-[#1C1C1E]'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isVerified}
                                  onChange={() => toggleUnitVerification(unit.id)}
                                  className="h-4 w-4 rounded border-[#D2D2D7] text-[#0071E3] focus:ring-[#0071E3]"
                                />
                                <div className="min-w-0">
                                  <div className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
                                    IMEI: {unit.imei || 'N/A'}
                                  </div>
                                  <div className="text-[11px] text-[#86868B] truncate">
                                    {[
                                      unit.serialNumber ? `S/N: ${unit.serialNumber}` : null,
                                      unit.storage ? `${unit.storage}GB` : null,
                                      unit.color,
                                    ].filter(Boolean).join(' · ')}
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0 ml-2">
                                {isUnaccounted ? (
                                  <Badge variant="warning" size="sm">UNACCOUNTED</Badge>
                                ) : (
                                  <Badge variant="success" size="sm">{unit.status}</Badge>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {/* UNACCOUNTED status warning */}
                    {missingUnits.length > 0 && (
                      <div className="rounded-xl border border-[#FF9F0A]/30 bg-[#FFF9F0] p-3 text-xs text-[#9E6200] dark:border-[#FF9F0A]/20 dark:bg-[#2E1F0A] dark:text-[#FF9F0A]">
                        ⚠️ <strong>{missingUnits.length} unit(s)</strong> were not verified during physical audit and will be marked <strong>UNACCOUNTED</strong>.
                      </div>
                    )}

                    {/* Restored units callout */}
                    {restoredUnits.length > 0 && (
                      <div className="rounded-xl border border-[#30D158]/30 bg-[#E9F9EE] p-3 text-xs text-[#1A7A3A] dark:border-[#30D158]/20 dark:bg-[#0A2E1A] dark:text-[#30D158]">
                        ℹ️ <strong>{restoredUnits.length} previously UNACCOUNTED unit(s)</strong> verified in physical audit will be restored to <strong>{location === 'WAREHOUSE' ? 'AVAILABLE' : 'IN_SHOP'}</strong>.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* reason / note textarea */}
            <div>
              <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">
                Reason / Note <span className="text-[#86868B] font-normal">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Monthly physical inventory count audit"
                className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3 py-2 text-xs text-[#1D1D1F] placeholder:text-[#AEAEB2] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/50 focus:border-[#0071E3] dark:border-[#38383A] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]"
              />
            </div>

            {/* footer buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8E8ED] dark:border-[#2C2C2E]">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>

              {selectedProduct.trackingType === 'QUANTITY' ? (
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  isLoading={isLoading}
                  disabled={!isValidPhysicalCount || qtyDifference === 0}
                >
                  {qtyDifference === 0 ? 'No Adjustment Needed' : 'Reconcile Stock'}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  isLoading={isLoading}
                  disabled={!isSerializedChanged || loadingDetail}
                >
                  {!isSerializedChanged ? 'No Adjustment Needed' : 'Reconcile Stock'}
                </Button>
              )}
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
