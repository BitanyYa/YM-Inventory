'use client';

import React, { useEffect, useState } from 'react';
import { InventoryProductItem, ProductUnitItem, TransferStockRequest } from '../../types/api';
import { inventoryService } from '../../services/inventory.service';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { CloseIcon } from '../ui/Icons';
import { Spinner } from '../ui/Spinner';

interface TransferStockModalProps {
  isOpen: boolean;
  product: InventoryProductItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const TransferStockModal: React.FC<TransferStockModalProps> = ({
  isOpen,
  product,
  onClose,
  onSuccess,
}) => {
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [warehouseUnits, setWarehouseUnits] = useState<ProductUnitItem[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSerialized = product?.trackingType === 'SERIALIZED';

  // Load warehouse units for serialized products
  useEffect(() => {
    if (!isOpen || !product || !isSerialized) return;
    setIsLoadingUnits(true);
    setSelectedUnitIds([]);
    inventoryService
      .getProductInventoryDetail(product.id)
      .then((res) => {
        const available = (res.data.units ?? []).filter(
          (u) => u.location === 'WAREHOUSE' && u.status === 'AVAILABLE',
        );
        setWarehouseUnits(available);
      })
      .catch(() => setWarehouseUnits([]))
      .finally(() => setIsLoadingUnits(false));
  }, [isOpen, product, isSerialized]);

  if (!isOpen || !product) return null;

  const warehouseQty = product.inventory.warehouseQuantity;

  const handleClose = () => {
    setQuantity('');
    setNote('');
    setSelectedUnitIds([]);
    setWarehouseUnits([]);
    setError(null);
    onClose();
  };

  const toggleUnit = (id: string) => {
    setSelectedUnitIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload: TransferStockRequest = { productId: product.id };

    if (isSerialized) {
      if (selectedUnitIds.length === 0) {
        setError('Select at least one unit to transfer.');
        return;
      }
      payload.unitIds = selectedUnitIds;
    } else {
      const qty = parseInt(quantity, 10);
      if (!quantity || isNaN(qty) || qty < 1) {
        setError('Quantity must be at least 1.');
        return;
      }
      if (qty > warehouseQty) {
        setError(`Only ${warehouseQty} unit(s) available in warehouse.`);
        return;
      }
      payload.quantity = qty;
    }

    if (note.trim()) payload.note = note.trim();

    setIsLoading(true);
    try {
      await inventoryService.transferStock(payload);
      handleClose();
      onSuccess();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message || 'Transfer failed. Please try again.');
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
      <div className="relative mt-8 mb-8 w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 p-5 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Transfer to Shop
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

        {/* Stock context strip */}
        <div className="flex items-center gap-4 border-b border-slate-100 bg-slate-50 px-5 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-800/50">
          <span className="text-slate-500">Warehouse:</span>
          <span className="font-bold text-slate-900 dark:text-slate-100">{warehouseQty}</span>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <span className="text-slate-500">Shop:</span>
          <span className="font-bold text-slate-900 dark:text-slate-100">
            {product.inventory.shopQuantity}
          </span>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </div>
          )}

          {!isSerialized ? (
            <Input
              label={`Quantity * (max ${warehouseQty})`}
              type="number"
              min={1}
              max={warehouseQty}
              placeholder="e.g. 5"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          ) : isLoadingUnits ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="md" />
            </div>
          ) : warehouseUnits.length === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-300">
              No available units in warehouse.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Select Units ({selectedUnitIds.length}/{warehouseUnits.length})
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedUnitIds(
                      selectedUnitIds.length === warehouseUnits.length
                        ? []
                        : warehouseUnits.map((u) => u.id),
                    )
                  }
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400"
                >
                  {selectedUnitIds.length === warehouseUnits.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                {warehouseUnits.map((unit) => {
                  const selected = selectedUnitIds.includes(unit.id);
                  return (
                    <button
                      key={unit.id}
                      type="button"
                      onClick={() => toggleUnit(unit.id)}
                      className={`w-full flex items-start gap-2.5 rounded-lg border p-2.5 text-left text-xs transition-colors ${
                        selected
                          ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      <span
                        className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded border ${
                          selected
                            ? 'border-white bg-white dark:border-slate-900 dark:bg-slate-900'
                            : 'border-slate-400'
                        }`}
                      />
                      <span className="min-w-0">
                        <span className="block font-semibold truncate">
                          {unit.imei ?? unit.serialNumber ?? unit.id.slice(0, 8)}
                        </span>
                        {(unit.storage || unit.color) && (
                          <span className={`block ${selected ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400'}`}>
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

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Note (Optional)
            </label>
            <textarea
              rows={2}
              className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              placeholder="e.g. Stocking shop for weekend"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <Button variant="secondary" type="button" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={isLoading}
              disabled={isSerialized && warehouseUnits.length === 0}
            >
              Transfer to Shop
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
