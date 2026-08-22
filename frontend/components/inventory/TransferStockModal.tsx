'use client';

import React, { useEffect, useState } from 'react';
import { InventoryProductItem, ProductUnitItem, TransferStockRequest } from '../../types/api';
import { inventoryService } from '../../services/inventory.service';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CloseIcon } from '../ui/Icons';
import { Spinner } from '../ui/Spinner';

interface Props { isOpen: boolean; product: InventoryProductItem | null; onClose: () => void; onSuccess: () => void; }

const unitBtnCls = (sel: boolean) =>
  `flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-xs transition-colors ${
    sel ? 'border-[#0071E3] bg-[#0071E3] text-white' : 'border-[#D2D2D7] bg-white text-[#1D1D1F] hover:border-[#0071E3]/40 dark:border-[#38383A] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]'
  }`;

export const TransferStockModal: React.FC<Props> = ({ isOpen, product, onClose, onSuccess }) => {
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [warehouseUnits, setWarehouseUnits] = useState<ProductUnitItem[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSerialized = product?.trackingType === 'SERIALIZED';

  useEffect(() => {
    if (!isOpen || !product || !isSerialized) return;
    setLoadingUnits(true); setSelectedIds([]);
    inventoryService.getProductInventoryDetail(product.id)
      .then((res) => setWarehouseUnits((res.data.units ?? []).filter((u) => u.location === 'WAREHOUSE' && u.status === 'AVAILABLE')))
      .catch(() => setWarehouseUnits([])).finally(() => setLoadingUnits(false));
  }, [isOpen, product, isSerialized]);

  if (!isOpen || !product) return null;
  const whQty = product.inventory.warehouseQuantity;
  const reset = () => { setQuantity(''); setNote(''); setSelectedIds([]); setWarehouseUnits([]); setError(null); };
  const handleClose = () => { reset(); onClose(); };
  const toggleUnit = (id: string) => setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    const payload: TransferStockRequest = { productId: product.id };
    if (isSerialized) {
      if (!selectedIds.length) { setError('Select at least one unit.'); return; }
      payload.unitIds = selectedIds;
    } else {
      const qty = parseInt(quantity, 10);
      if (!qty || qty < 1) { setError('Quantity must be at least 1.'); return; }
      if (qty > whQty) { setError(`Only ${whQty} unit(s) available in warehouse.`); return; }
      payload.quantity = qty;
    }
    if (note.trim()) payload.note = note.trim();
    setIsLoading(true);
    try { await inventoryService.transferStock(payload); reset(); onSuccess(); onClose(); }
    catch (err: unknown) { setError((err as { message?: string })?.message || 'Transfer failed.'); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-[#D2D2D7] bg-white shadow-xl dark:border-[#38383A] dark:bg-[#1C1C1E]">
        <div className="flex items-start justify-between border-b border-[#E8E8ED] px-5 py-4 dark:border-[#2C2C2E]">
          <div>
            <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Transfer to Shop</h3>
            <p className="text-xs text-[#6E6E73]">{product.name}{product.brand ? ` · ${product.brand}` : ''}</p>
          </div>
          <button onClick={handleClose} className="ml-4 rounded-lg p-1 text-[#86868B] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]"><CloseIcon size={18} /></button>
        </div>

        <div className="flex items-center gap-4 border-b border-[#E8E8ED] bg-[#F5F5F7] px-5 py-2.5 text-xs dark:border-[#2C2C2E] dark:bg-[#2C2C2E]">
          <span className="text-[#6E6E73]">Warehouse:</span><span className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">{whQty}</span>
          <span className="text-[#D2D2D7]">|</span>
          <span className="text-[#6E6E73]">Shop:</span><span className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">{product.inventory.shopQuantity}</span>
        </div>

        {error && <div className="mx-5 mt-4 rounded-lg border border-[#FF3B30]/20 bg-[#FFECEB] px-3 py-2 text-xs text-[#CC2B22] dark:border-[#FF453A]/20 dark:bg-[#2E0A09] dark:text-[#FF453A]">{error}</div>}

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {!isSerialized ? (
            <Input label={`Quantity * (max ${whQty})`} type="number" min={1} max={whQty} placeholder="e.g. 5" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          ) : loadingUnits ? (
            <div className="flex justify-center py-6"><Spinner size="md" /></div>
          ) : warehouseUnits.length === 0 ? (
            <p className="rounded-xl border border-[#FF9F0A]/30 bg-[#FFF4E0] px-3 py-2.5 text-xs text-[#995E00]">No available units in warehouse.</p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#86868B]">Select Units ({selectedIds.length}/{warehouseUnits.length})</span>
                <button type="button" onClick={() => setSelectedIds(selectedIds.length === warehouseUnits.length ? [] : warehouseUnits.map((u) => u.id))} className="text-xs font-semibold text-[#0071E3] hover:text-[#0077ED]">
                  {selectedIds.length === warehouseUnits.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="max-h-48 space-y-1.5 overflow-y-auto">
                {warehouseUnits.map((unit) => {
                  const sel = selectedIds.includes(unit.id);
                  return (
                    <button key={unit.id} type="button" onClick={() => toggleUnit(unit.id)} className={unitBtnCls(sel)}>
                      <span className={`h-3.5 w-3.5 shrink-0 rounded border ${sel ? 'border-white bg-white' : 'border-[#D2D2D7]'}`} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{unit.imei ?? unit.serialNumber ?? unit.id.slice(0, 8)}</span>
                        {(unit.storage || unit.color) && <span className={sel ? 'opacity-75' : 'text-[#86868B]'}>{[unit.storage ? `${unit.storage}GB` : null, unit.color].filter(Boolean).join(' · ')}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">Note (Optional)</label>
            <textarea rows={2} className="w-full rounded-lg border border-[#D2D2D7] bg-white px-3 py-1.5 text-sm text-[#1D1D1F] placeholder:text-[#AEAEB2] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/50 dark:border-[#38383A] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]" placeholder="e.g. Stocking shop for weekend" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" onClick={handleClose} disabled={isLoading}>Cancel</Button>
            <Button variant="primary" type="submit" isLoading={isLoading} disabled={isSerialized && warehouseUnits.length === 0}>Transfer to Shop</Button>
          </div>
        </form>
      </div>
    </div>
  );
};
