'use client';

import React, { useEffect, useState } from 'react';
import { InventoryProductItem, ProductUnitItem, SellStockRequest } from '../../types/api';
import { inventoryService } from '../../services/inventory.service';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CloseIcon } from '../ui/Icons';
import { Spinner } from '../ui/Spinner';

interface Props {
  isOpen: boolean;
  product: InventoryProductItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const SellStockModal: React.FC<Props> = ({ isOpen, product, onClose, onSuccess }) => {
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [shopUnits, setShopUnits] = useState<ProductUnitItem[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSerialized = product?.trackingType === 'SERIALIZED';

  useEffect(() => {
    if (!isOpen || !product || !isSerialized) return;
    setLoadingUnits(true);
    setSelectedIds([]);
    inventoryService.getProductInventoryDetail(product.id)
      .then((res) => setShopUnits((res.data.units ?? []).filter((u) => u.location === 'SHOP' && u.status === 'IN_SHOP')))
      .catch(() => setShopUnits([]))
      .finally(() => setLoadingUnits(false));
  }, [isOpen, product, isSerialized]);

  if (!isOpen || !product) return null;

  const shopQty = product.inventory.shopQuantity;

  const reset = () => { setQuantity(''); setNote(''); setSelectedIds([]); setShopUnits([]); setError(null); };
  const handleClose = () => { reset(); onClose(); };
  const toggleUnit = (id: string) => setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload: SellStockRequest = { productId: product.id };

    if (isSerialized) {
      if (!selectedIds.length) { setError('Select at least one unit.'); return; }
      payload.unitIds = selectedIds;
    } else {
      const qty = parseInt(quantity, 10);
      if (!qty || qty < 1) { setError('Quantity must be at least 1.'); return; }
      if (qty > shopQty) { setError(`Only ${shopQty} unit(s) available in shop.`); return; }
      payload.quantity = qty;
    }

    if (note.trim()) payload.note = note.trim();

    setIsLoading(true);
    try {
      await inventoryService.sellStock(payload);
      reset(); onSuccess(); onClose();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Sale failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={handleClose} />

      <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        {/* header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Sell Stock</h3>
            <p className="text-xs text-slate-500">{product.name}{product.brand ? ` · ${product.brand}` : ''}</p>
          </div>
          <button onClick={handleClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
            <CloseIcon size={20} />
          </button>
        </div>

        {/* stock context */}
        <div className="mt-4 flex items-center gap-4 rounded-lg bg-slate-50 px-4 py-2.5 text-xs dark:bg-slate-800/50">
          <span className="text-slate-500">Shop (available):</span>
          <span className="font-bold text-slate-900 dark:text-slate-100">{shopQty}</span>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {!isSerialized ? (
            <Input label={`Quantity * (max ${shopQty})`} type="number" min={1} max={shopQty}
              placeholder="e.g. 2" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          ) : loadingUnits ? (
            <div className="flex justify-center py-6"><Spinner size="md" /></div>
          ) : shopUnits.length === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-300">
              No units in shop. Transfer from warehouse first.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Select Units ({selectedIds.length}/{shopUnits.length})
                </span>
                <button type="button"
                  onClick={() => setSelectedIds(selectedIds.length === shopUnits.length ? [] : shopUnits.map((u) => u.id))}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400">
                  {selectedIds.length === shopUnits.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                {shopUnits.map((unit) => {
                  const sel = selectedIds.includes(unit.id);
                  return (
                    <button key={unit.id} type="button" onClick={() => toggleUnit(unit.id)}
                      className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-xs transition-colors ${
                        sel
                          ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                      <span className={`h-3.5 w-3.5 shrink-0 rounded border ${sel ? 'border-white bg-white dark:border-slate-900 dark:bg-slate-900' : 'border-slate-400'}`} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">
                          {unit.imei ?? unit.serialNumber ?? unit.id.slice(0, 8)}
                        </span>
                        {(unit.storage || unit.color) && (
                          <span className={sel ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400'}>
                            {[unit.storage ? `${unit.storage}GB` : null, unit.color].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Note (Optional)</label>
            <textarea rows={2}
              className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              placeholder="e.g. Sold to walk-in customer"
              value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={handleClose} disabled={isLoading}>Cancel</Button>
            <Button variant="primary" type="submit" isLoading={isLoading}
              disabled={isSerialized && shopUnits.length === 0}>
              Confirm Sale
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
