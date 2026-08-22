'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  InventoryProductItem,
  ProductItem,
  ReceiveStockRequest,
  ReceiveUnitRequest,
  TrackingType,
} from '../../types/api';
import { inventoryService } from '../../services/inventory.service';
import { productService } from '../../services/product.service';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { CloseIcon, SearchIcon } from '../ui/Icons';

/* ─── types ──────────────────────────────────────────────────────────────── */

interface Props {
  isOpen: boolean;
  /** Pre-selected product (from row action). When null, shows product-search step first. */
  product: InventoryProductItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface UnitRow {
  id: number;
  imei: string;
  serialNumber: string;
  storage: string;
  color: string;
  purchasePrice: string;
}

/* ─── helpers ─────────────────────────────────────────────────────────────── */

const blankUnit = (id: number): UnitRow => ({
  id, imei: '', serialNumber: '', storage: '', color: '', purchasePrice: '',
});

const inputCls =
  'w-full rounded-lg border border-[#D2D2D7] bg-white px-3 py-1.5 text-sm text-[#1D1D1F] placeholder:text-[#AEAEB2] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/50 focus:border-[#0071E3] dark:border-[#38383A] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]';

function trackingLabel(t: TrackingType) {
  return t === 'SERIALIZED' ? 'Serialized · IMEI' : 'Quantity';
}

/* ═══════════════════════════════════════════════════════════════════════════ */

export const ReceiveStockModal: React.FC<Props> = ({
  isOpen, product: preselectedProduct, onClose, onSuccess,
}) => {
  /* ── phase: 'select' shown only when no product pre-selected ── */
  const needsSelection = preselectedProduct === null;
  const [phase, setPhase] = useState<'select' | 'receive'>(
    needsSelection ? 'select' : 'receive',
  );

  /* ── selected product (phase 2) ── */
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | InventoryProductItem | null>(
    preselectedProduct,
  );

  /* ── product search (phase 1) ── */
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProductItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* ── receive form ── */
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [units, setUnits] = useState<UnitRow[]>([blankUnit(1)]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── sync when preselectedProduct changes ── */
  useEffect(() => {
    if (!isOpen) return;
    if (preselectedProduct) {
      setPhase('receive');
      setSelectedProduct(preselectedProduct);
    } else {
      setPhase('select');
      setSelectedProduct(null);
    }
    // reset form fields on open
    setQuantity(''); setPurchasePrice(''); setReference(''); setNote('');
    setUnits([blankUnit(1)]); setError(null);
    setSearchQuery(''); setDebouncedQuery(''); setSearchResults([]); setSearchError(null);
  }, [isOpen, preselectedProduct]);

  /* ── focus search input when entering select phase ── */
  useEffect(() => {
    if (isOpen && phase === 'select') {
      setTimeout(() => searchInputRef.current?.focus(), 80);
    }
  }, [isOpen, phase]);

  /* ── debounce search query ── */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  /* ── search products ── */
  const runSearch = useCallback(async () => {
    if (!debouncedQuery.trim()) { setSearchResults([]); return; }
    setSearchLoading(true); setSearchError(null);
    try {
      const res = await productService.getProducts({
        search: debouncedQuery.trim(),
        isActive: true,
        limit: 8,
      });
      setSearchResults(res.data ?? []);
    } catch (e: unknown) {
      setSearchError((e as { message?: string })?.message ?? 'Search failed.');
    } finally {
      setSearchLoading(false);
    }
  }, [debouncedQuery]);

  useEffect(() => { runSearch(); }, [runSearch]);

  if (!isOpen) return null;

  const isSerialized = selectedProduct?.trackingType === 'SERIALIZED';

  /* ── reset & close ── */
  const handleClose = () => {
    setPhase(needsSelection ? 'select' : 'receive');
    setSelectedProduct(needsSelection ? null : preselectedProduct);
    setQuantity(''); setPurchasePrice(''); setReference(''); setNote('');
    setUnits([blankUnit(1)]); setError(null);
    setSearchQuery(''); setSearchResults([]); setSearchError(null);
    onClose();
  };

  /* ── product selection (phase 1 → 2) ── */
  const handleSelectProduct = (p: ProductItem) => {
    setSelectedProduct(p);
    setPhase('receive');
    setUnits([blankUnit(1)]);
    setQuantity(''); setPurchasePrice(''); setReference(''); setNote(''); setError(null);
  };

  const handleBackToSearch = () => {
    setSelectedProduct(null);
    setPhase('select');
    setError(null);
  };

  /* ── unit helpers ── */
  const updateUnit = (id: number, field: keyof UnitRow, value: string) =>
    setUnits((prev) => prev.map((u) => (u.id === id ? { ...u, [field]: value } : u)));

  const addUnit = () => setUnits((p) => [...p, blankUnit(Date.now())]);
  const removeUnit = (id: number) => setUnits((p) => p.filter((u) => u.id !== id));

  /* ── submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setError(null);

    const payload: ReceiveStockRequest = { productId: selectedProduct.id };

    if (isSerialized) {
      /* check for duplicates within the form */
      const imeis = units.map((u) => u.imei.trim().toLowerCase()).filter(Boolean);
      const dupes = imeis.filter((v, i) => imeis.indexOf(v) !== i);
      if (dupes.length > 0) {
        setError(`Duplicate IMEI in this batch: ${dupes[0]}`);
        return;
      }

      const parsed: ReceiveUnitRequest[] = [];
      for (const u of units) {
        if (!u.imei.trim()) { setError('IMEI is required for every unit.'); return; }
        const pp = parseFloat(u.purchasePrice);
        if (isNaN(pp) || pp <= 0) {
          setError(`Purchase price must be greater than 0 for IMEI "${u.imei}".`);
          return;
        }
        parsed.push({
          imei: u.imei.trim(),
          serialNumber: u.serialNumber.trim() || undefined,
          storage: u.storage ? parseInt(u.storage, 10) : undefined,
          color: u.color.trim() || undefined,
          purchasePrice: pp,
        });
      }
      payload.units = parsed;
    } else {
      const qty = parseInt(quantity, 10);
      const pp = parseFloat(purchasePrice);
      if (isNaN(qty) || qty < 1) { setError('Quantity must be at least 1.'); return; }
      if (isNaN(pp) || pp <= 0) { setError('Purchase price must be greater than 0.'); return; }
      payload.quantity = qty;
      payload.purchasePrice = pp;
    }

    if (reference.trim()) payload.reference = reference.trim();
    if (note.trim()) payload.note = note.trim();

    setSubmitLoading(true);
    try {
      await inventoryService.receiveStock(payload);
      handleClose();
      onSuccess();
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Failed to receive stock.';
      /* make duplicate IMEI errors more readable */
      setError(
        msg.includes('IMEI') ? msg
          : msg.includes('already exists') ? 'A unit with this IMEI is already registered in the system.'
          : msg,
      );
    } finally {
      setSubmitLoading(false);
    }
  };

  /* ─────────────────────────────────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative my-8 w-full max-w-lg rounded-2xl border border-[#D2D2D7] bg-white shadow-xl dark:border-[#38383A] dark:bg-[#1C1C1E]">

        {/* ── header ── */}
        <div className="flex items-start justify-between border-b border-[#E8E8ED] px-5 py-4 dark:border-[#2C2C2E]">
          <div>
            <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Receive Stock
            </h3>
            <p className="mt-0.5 text-xs text-[#6E6E73]">
              {phase === 'select'
                ? 'Search and select a product to receive stock for.'
                : selectedProduct
                  ? `${selectedProduct.name}${selectedProduct.brand ? ` · ${selectedProduct.brand}` : ''}`
                  : 'Configure stock being received.'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="ml-4 shrink-0 rounded-lg p-1 text-[#86868B] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ── PHASE 1: product search ── */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {phase === 'select' && (
          <div className="px-5 py-4 space-y-3">
            {/* search input */}
            <div className="relative">
              <SearchIcon
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#AEAEB2]"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or brand…"
                className={`${inputCls} pl-9`}
              />
              {searchLoading && (
                <Spinner
                  size="sm"
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                />
              )}
            </div>

            {/* results */}
            <div className="min-h-[120px]">
              {searchError && (
                <p className="text-xs text-[#CC2B22]">{searchError}</p>
              )}

              {!searchLoading && !searchError && debouncedQuery && searchResults.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <p className="text-xs text-[#6E6E73]">No products found for "{debouncedQuery}".</p>
                  <p className="text-[11px] text-[#86868B]">
                    Product doesn't exist yet?{' '}
                    <Link
                      href="/products"
                      onClick={handleClose}
                      className="text-[#0071E3] hover:underline"
                    >
                      Go to Products to create it
                    </Link>
                  </p>
                </div>
              )}

              {!debouncedQuery && (
                <p className="pt-4 text-center text-xs text-[#86868B]">
                  Type to search active products.
                </p>
              )}

              {searchResults.length > 0 && (
                <div className="divide-y divide-[#F5F5F7] overflow-hidden rounded-xl border border-[#E8E8ED] dark:divide-[#2C2C2E] dark:border-[#38383A]">
                  {searchResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectProduct(p)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {p.name}
                        </p>
                        <p className="truncate text-[11px] text-[#86868B]">
                          {[p.brand, p.category?.name].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge
                          variant={p.trackingType === 'SERIALIZED' ? 'info' : 'neutral'}
                          size="sm"
                        >
                          {trackingLabel(p.trackingType)}
                        </Badge>
                        <Badge variant={
                          p.stockStatus === 'IN_STOCK' ? 'success'
                            : p.stockStatus === 'LOW_STOCK' ? 'warning'
                            : 'danger'
                        } size="sm">
                          {p.inventory.totalQuantity}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* footer */}
            <div className="flex items-center justify-end pt-1">
              <Button variant="secondary" size="sm" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ── PHASE 2: receive form ── */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {phase === 'receive' && selectedProduct && (
          <>
            {/* product summary strip */}
            <div className="flex items-center justify-between border-b border-[#E8E8ED] bg-[#F5F5F7] px-5 py-2.5 dark:border-[#2C2C2E] dark:bg-[#2C2C2E]">
              <div className="flex items-center gap-2 min-w-0">
                <Badge
                  variant={selectedProduct.trackingType === 'SERIALIZED' ? 'info' : 'neutral'}
                  size="sm"
                >
                  {trackingLabel(selectedProduct.trackingType)}
                </Badge>
                {selectedProduct.category && (
                  <span className="text-xs text-[#6E6E73]">{selectedProduct.category.name}</span>
                )}
                {'inventory' in selectedProduct && (
                  <span className="text-xs text-[#86868B]">
                    WH: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {selectedProduct.inventory.warehouseQuantity}
                    </strong>
                    {' '} Shop: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {selectedProduct.inventory.shopQuantity}
                    </strong>
                  </span>
                )}
              </div>
              {/* back to search only if we came from the product-search phase */}
              {needsSelection && (
                <button
                  type="button"
                  onClick={handleBackToSearch}
                  className="ml-3 shrink-0 text-[11px] font-medium text-[#0071E3] hover:text-[#0077ED]"
                >
                  ← Change
                </button>
              )}
            </div>

            {/* error banner */}
            {error && (
              <div className="mx-5 mt-4 rounded-lg border border-[#FF3B30]/20 bg-[#FFECEB] px-3 py-2 text-xs text-[#CC2B22] dark:border-[#FF453A]/20 dark:bg-[#2E0A09] dark:text-[#FF453A]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">

              {/* ── QUANTITY form ── */}
              {!isSerialized && (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Quantity *"
                    type="number"
                    min={1}
                    step={1}
                    placeholder="e.g. 20"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required
                  />
                  <Input
                    label="Purchase Price / Unit (ETB) *"
                    type="number"
                    min={0.01}
                    step={0.01}
                    placeholder="e.g. 450.00"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* ── SERIALIZED units ── */}
              {isSerialized && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#86868B]">
                      Units to receive ({units.length})
                    </span>
                    <button
                      type="button"
                      onClick={addUnit}
                      className="text-xs font-semibold text-[#0071E3] hover:text-[#0077ED]"
                    >
                      + Add Unit
                    </button>
                  </div>

                  {/* units list */}
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-0.5">
                    {units.map((unit, idx) => (
                      <div
                        key={unit.id}
                        className="rounded-xl border border-[#E8E8ED] bg-[#F5F5F7] p-3 space-y-2 dark:border-[#38383A] dark:bg-[#2C2C2E]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                            Unit {idx + 1}
                          </span>
                          {units.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeUnit(unit.id)}
                              className="text-[11px] font-medium text-[#FF3B30] hover:text-[#E6362B]"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="col-span-2">
                            <Input
                              label="IMEI *"
                              placeholder="e.g. 356938035643809"
                              value={unit.imei}
                              onChange={(e) => updateUnit(unit.id, 'imei', e.target.value)}
                            />
                          </div>
                          <Input
                            label="Purchase Price (ETB) *"
                            type="number"
                            min={0.01}
                            step={0.01}
                            placeholder="e.g. 25000"
                            value={unit.purchasePrice}
                            onChange={(e) => updateUnit(unit.id, 'purchasePrice', e.target.value)}
                          />
                          <Input
                            label="Serial Number"
                            placeholder="Optional"
                            value={unit.serialNumber}
                            onChange={(e) => updateUnit(unit.id, 'serialNumber', e.target.value)}
                          />
                          <Input
                            label="Storage (GB)"
                            type="number"
                            min={1}
                            placeholder="e.g. 128"
                            value={unit.storage}
                            onChange={(e) => updateUnit(unit.id, 'storage', e.target.value)}
                          />
                          <Input
                            label="Color"
                            placeholder="e.g. Midnight Black"
                            value={unit.color}
                            onChange={(e) => updateUnit(unit.id, 'color', e.target.value)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* units summary row */}
                  <p className="text-right text-[11px] text-[#86868B]">
                    {units.length} unit{units.length !== 1 ? 's' : ''} · all will be placed in Warehouse (Available)
                  </p>
                </div>
              )}

              {/* ── optional fields ── */}
              <Input
                label="Batch Reference (optional)"
                placeholder="e.g. BATCH-2026-001"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />

              <div>
                <label className="block text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">
                  Note (optional)
                </label>
                <textarea
                  rows={2}
                  className={inputCls}
                  placeholder="e.g. Received from supplier XYZ"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              {/* ── footer ── */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={handleClose}
                  disabled={submitLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  isLoading={submitLoading}
                >
                  Receive into Warehouse
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
