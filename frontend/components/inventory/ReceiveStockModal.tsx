'use client';

import React, { useState } from 'react';
import { InventoryProductItem, ReceiveStockRequest, ReceiveUnitRequest } from '../../types/api';
import { inventoryService } from '../../services/inventory.service';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CloseIcon } from '../ui/Icons';

interface ReceiveStockModalProps {
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

const emptyUnit = (id: number): UnitRow => ({
  id,
  imei: '',
  serialNumber: '',
  storage: '',
  color: '',
  purchasePrice: '',
});

export const ReceiveStockModal: React.FC<ReceiveStockModalProps> = ({
  isOpen,
  product,
  onClose,
  onSuccess,
}) => {
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [units, setUnits] = useState<UnitRow[]>([emptyUnit(1)]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !product) return null;

  const isSerialized = product.trackingType === 'SERIALIZED';

  const handleClose = () => {
    setQuantity('');
    setPurchasePrice('');
    setReference('');
    setNote('');
    setUnits([emptyUnit(1)]);
    setError(null);
    onClose();
  };

  const updateUnit = (id: number, field: keyof UnitRow, value: string) => {
    setUnits((prev) =>
      prev.map((u) => (u.id === id ? { ...u, [field]: value } : u)),
    );
  };

  const addUnit = () => {
    setUnits((prev) => [...prev, emptyUnit(Date.now())]);
  };

  const removeUnit = (id: number) => {
    if (units.length === 1) return;
    setUnits((prev) => prev.filter((u) => u.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload: ReceiveStockRequest = { productId: product.id };

    if (isSerialized) {
      const parsedUnits: ReceiveUnitRequest[] = [];
      for (const u of units) {
        if (!u.imei.trim()) {
          setError('IMEI is required for every unit.');
          return;
        }
        const pp = parseFloat(u.purchasePrice);
        if (!u.purchasePrice || isNaN(pp) || pp <= 0) {
          setError(`Purchase price must be greater than 0 for IMEI "${u.imei}".`);
          return;
        }
        parsedUnits.push({
          imei: u.imei.trim(),
          serialNumber: u.serialNumber.trim() || undefined,
          storage: u.storage ? parseInt(u.storage, 10) : undefined,
          color: u.color.trim() || undefined,
          purchasePrice: pp,
        });
      }
      payload.units = parsedUnits;
    } else {
      const qty = parseInt(quantity, 10);
      const pp = parseFloat(purchasePrice);
      if (!quantity || isNaN(qty) || qty < 1) {
        setError('Quantity must be at least 1.');
        return;
      }
      if (!purchasePrice || isNaN(pp) || pp <= 0) {
        setError('Purchase price must be greater than 0.');
        return;
      }
      payload.quantity = qty;
      payload.purchasePrice = pp;
    }

    if (reference.trim()) payload.reference = reference.trim();
    if (note.trim()) payload.note = note.trim();

    setIsLoading(true);
    try {
      await inventoryService.receiveStock(payload);
      handleClose();
      onSuccess();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message || 'Failed to receive stock. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative mt-8 mb-8 w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 p-5 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Receive Stock
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {product.name}
              {product.brand ? ` · ${product.brand}` : ''}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="ml-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </div>
          )}

          {/* QUANTITY form */}
          {!isSerialized && (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Quantity *"
                type="number"
                min={1}
                placeholder="e.g. 20"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
              <Input
                label="Purchase Price (ETB) *"
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

          {/* SERIALIZED units */}
          {isSerialized && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Units ({units.length})
                </span>
                <button
                  type="button"
                  onClick={addUnit}
                  className="text-xs font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300"
                >
                  + Add Unit
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
                {units.map((unit, idx) => (
                  <div
                    key={unit.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Unit {idx + 1}
                      </span>
                      {units.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeUnit(unit.id)}
                          className="text-[11px] text-red-500 hover:text-red-700"
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
                        label="Serial Number"
                        placeholder="Optional"
                        value={unit.serialNumber}
                        onChange={(e) => updateUnit(unit.id, 'serialNumber', e.target.value)}
                      />
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
            </div>
          )}

          {/* Shared fields */}
          <Input
            label="Batch Reference"
            placeholder="e.g. BATCH-2026-001 (optional)"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Note (Optional)
            </label>
            <textarea
              rows={2}
              className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              placeholder="e.g. Received from supplier XYZ"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <Button variant="secondary" type="button" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isLoading}>
              Receive into Warehouse
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
