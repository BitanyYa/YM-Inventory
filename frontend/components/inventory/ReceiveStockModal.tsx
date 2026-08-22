'use client';

import React, { useState } from 'react';
import { InventoryProductItem, ReceiveStockRequest, ReceiveUnitRequest } from '../../types/api';
import { inventoryService } from '../../services/inventory.service';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CloseIcon } from '../ui/Icons';

interface Props {
  isOpen: boolean;
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

const blankUnit = (id: number): UnitRow => ({
  id, imei: '', serialNumber: '', storage: '', color: '', purchasePrice: '',
});

export const ReceiveStockModal: React.FC<Props> = ({ isOpen, product, onClose, onSuccess }) => {
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [units, setUnits] = useState<UnitRow[]>([blankUnit(1)]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !product) return null;

  const isSerialized = product.trackingType === 'SERIALIZED';

  const reset = () => {
    setQuantity(''); setPurchasePrice(''); setReference(''); setNote('');
    setUnits([blankUnit(1)]); setError(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const updateUnit = (id: number, field: keyof UnitRow, value: string) =>
    setUnits((prev) => prev.map((u) => (u.id === id ? { ...u, [field]: value } : u)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload: ReceiveStockRequest = { productId: product.id };

    if (isSerialized) {
      const parsed: ReceiveUnitRequest[] = [];
      for (const u of units) {
        if (!u.imei.trim()) { setError('IMEI is required for every unit.'); return; }
        const pp = parseFloat(u.purchasePrice);
        if (!pp || pp <= 0) { setError(`Purchase price must be > 0 for IMEI "${u.imei}".`); return; }
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
      if (!qty || qty < 1) { setError('Quantity must be at least 1.'); return; }
      if (!pp || pp <= 0) { setError('Purchase price must be greater than 0.'); return; }
      payload.quantity = qty;
      payload.purchasePrice = pp;
    }

    if (reference.trim()) payload.reference = reference.trim();
    if (note.trim()) payload.note = note.trim();

    setIsLoading(true);
    try {
      await inventoryService.receiveStock(payload);
      reset(); onSuccess(); onClose();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to receive stock.');
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
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Receive Stock</h3>
            <p className="text-xs text-slate-500">{product.name}{product.brand ? ` · ${product.brand}` : ''}</p>
          </div>
          <button onClick={handleClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
            <CloseIcon size={20} />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* QUANTITY fields */}
          {!isSerialized && (
            <div className="grid grid-cols-2 gap-3">
              <Input label="Quantity *" type="number" min={1} placeholder="e.g. 20"
                value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
              <Input label="Purchase Price (ETB) *" type="number" min={0.01} step={0.01}
                placeholder="e.g. 450.00" value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)} required />
            </div>
          )}

          {/* SERIALIZED unit rows */}
          {isSerialized && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Units ({units.length})
                </span>
                <button type="button" onClick={() => setUnits((p) => [...p, blankUnit(Date.now())])}
                  className="text-xs font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300">
                  + Add Unit
                </button>
              </div>
              <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
                {units.map((unit, idx) => (
                  <div key={unit.id} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Unit {idx + 1}</span>
                      {units.length > 1 && (
                        <button type="button" onClick={() => setUnits((p) => p.filter((u) => u.id !== unit.id))}
                          className="text-[11px] text-red-500 hover:text-red-700">Remove</button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <Input label="IMEI *" placeholder="e.g. 356938035643809"
                          value={unit.imei} onChange={(e) => updateUnit(unit.id, 'imei', e.target.value)} />
                      </div>
                      <Input label="Purchase Price (ETB) *" type="number" min={0.01} step={0.01}
                        placeholder="e.g. 25000" value={unit.purchasePrice}
                        onChange={(e) => updateUnit(unit.id, 'purchasePrice', e.target.value)} />
                      <Input label="Serial Number" placeholder="Optional"
                        value={unit.serialNumber} onChange={(e) => updateUnit(unit.id, 'serialNumber', e.target.value)} />
                      <Input label="Storage (GB)" type="number" min={1} placeholder="e.g. 128"
                        value={unit.storage} onChange={(e) => updateUnit(unit.id, 'storage', e.target.value)} />
                      <Input label="Color" placeholder="e.g. Black"
                        value={unit.color} onChange={(e) => updateUnit(unit.id, 'color', e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Input label="Batch Reference" placeholder="e.g. BATCH-2026-001 (optional)"
            value={reference} onChange={(e) => setReference(e.target.value)} />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Note (Optional)
            </label>
            <textarea rows={2}
              className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              placeholder="e.g. Received from supplier XYZ"
              value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={handleClose} disabled={isLoading}>Cancel</Button>
            <Button variant="primary" type="submit" isLoading={isLoading}>Receive into Warehouse</Button>
          </div>
        </form>
      </div>
    </div>
  );
};
