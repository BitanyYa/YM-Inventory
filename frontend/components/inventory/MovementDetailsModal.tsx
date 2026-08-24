'use client';

import React, { useEffect, useState } from 'react';
import { StockMovementItem, MovementType } from '../../types/api';
import { inventoryService } from '../../services/inventory.service';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { CloseIcon, AlertTriangleIcon } from '../ui/Icons';
import { formatCurrency, formatDate } from '../../lib/utils';

interface MovementDetailsModalProps {
  isOpen: boolean;
  movementId: string | null;
  onClose: () => void;
}

function movementBadgeVariant(type: MovementType): 'info' | 'neutral' | 'success' | 'warning' | 'danger' {
  switch (type) {
    case 'STOCK_IN': return 'info';
    case 'TRANSFER': return 'neutral';
    case 'SALE': return 'success';
    case 'RETURN': return 'warning';
    case 'DAMAGE':
    case 'LOSS': return 'danger';
    case 'ADJUSTMENT': return 'warning';
    default: return 'neutral';
  }
}

function locationFlowDisplay(m: StockMovementItem): string {
  if (m.movementType === 'STOCK_IN') return `→ ${m.toLocation ?? 'WAREHOUSE'}`;
  if (m.movementType === 'TRANSFER') return `${m.fromLocation ?? 'WAREHOUSE'} → ${m.toLocation ?? 'SHOP'}`;
  if (m.movementType === 'SALE') return `${m.fromLocation ?? 'SHOP'} → SOLD`;
  if (m.movementType === 'RETURN') return `SOLD → ${m.toLocation ?? 'WAREHOUSE'}`;
  if (m.movementType === 'DAMAGE' || m.movementType === 'LOSS') return `${m.fromLocation ?? '—'} → —`;
  if (m.movementType === 'ADJUSTMENT') return m.fromLocation || m.toLocation || 'AUDIT';
  return [m.fromLocation, m.toLocation].filter(Boolean).join(' → ') || '—';
}

function getAdjustmentDetail(note?: string | null) {
  if (!note) return null;
  const lower = note.toLowerCase();
  if (lower.includes('surplus') || lower.includes('found') || lower.includes('+')) {
    return { type: 'SURPLUS' as const, label: 'Stock Surplus (Found)' };
  }
  if (lower.includes('shortage') || lower.includes('missing') || lower.includes('-') || lower.includes('unaccounted')) {
    return { type: 'SHORTAGE' as const, label: 'Stock Shortage (Unaccounted)' };
  }
  return null;
}

export const MovementDetailsModal: React.FC<MovementDetailsModalProps> = ({
  isOpen,
  movementId,
  onClose,
}) => {
  const [movement, setMovement] = useState<StockMovementItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !movementId) {
      setMovement(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    inventoryService
      .getMovement(movementId)
      .then((res) => {
        if (isMounted) {
          setMovement(res.data);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError((err as { message?: string })?.message || 'Failed to load transaction details.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, movementId]);

  if (!isOpen) return null;

  const adj = movement?.movementType === 'ADJUSTMENT' ? getAdjustmentDetail(movement.note) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* modal content */}
      <div className="relative w-full max-w-xl rounded-2xl border border-[#D2D2D7] bg-white shadow-2xl dark:border-[#38383A] dark:bg-[#1C1C1E] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* header */}
        <div className="flex items-center justify-between border-b border-[#E8E8ED] px-4 py-3 dark:border-[#2C2C2E]">
          <div>
            <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Transaction Details
            </h3>
            <p className="text-[11px] text-[#6E6E73]">
              Stock movement record #{movementId?.substring(0, 8)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[#86868B] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] dark:hover:bg-[#2C2C2E]"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="md" className="text-[#0071E3]" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 rounded-xl border border-[#FF3B30]/20 bg-[#FFECEB] p-3 text-xs text-[#CC2B22] dark:border-[#FF453A]/20 dark:bg-[#2E0A09] dark:text-[#FF453A]">
              <AlertTriangleIcon size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          ) : movement ? (
            <>
              {/* Product overview banner */}
              <div className="rounded-xl border border-[#E8E8ED] bg-[#F5F5F7] p-3 dark:border-[#2C2C2E] dark:bg-[#2C2C2E] space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {movement.product.name}
                    </h4>
                    <p className="text-xs text-[#6E6E73]">
                      {movement.product.brand} · {movement.product.category?.name || 'Uncategorized'}
                    </p>
                  </div>
                  <Badge variant={movement.product.trackingType === 'SERIALIZED' ? 'info' : 'neutral'} size="sm">
                    {movement.product.trackingType === 'SERIALIZED' ? 'Serialized' : 'Quantity'}
                  </Badge>
                </div>
              </div>

              {/* Transaction Breakdown */}
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                <div className="rounded-xl border border-[#E8E8ED] p-2.5 dark:border-[#2C2C2E]">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                    Operation
                  </span>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Badge variant={movementBadgeVariant(movement.movementType)} size="sm">
                      {movement.movementType.replace('_', ' ')}
                    </Badge>
                    {adj && (
                      <span className={`text-[10px] font-semibold ${adj.type === 'SURPLUS' ? 'text-[#30D158]' : 'text-[#FF3B30]'}`}>
                        {adj.type === 'SURPLUS' ? '+Surplus' : '-Shortage'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-[#E8E8ED] p-2.5 dark:border-[#2C2C2E]">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                    Quantity
                  </span>
                  <span className="mt-1 block font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {movement.quantity} {movement.quantity === 1 ? 'unit' : 'units'}
                  </span>
                </div>

                <div className="rounded-xl border border-[#E8E8ED] p-2.5 dark:border-[#2C2C2E]">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                    Location Flow
                  </span>
                  <span className="mt-1 block font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {locationFlowDisplay(movement)}
                  </span>
                </div>

                <div className="rounded-xl border border-[#E8E8ED] p-2.5 dark:border-[#2C2C2E]">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                    Performed By
                  </span>
                  <span className="mt-1 block font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {movement.createdBy?.name || 'System'}
                  </span>
                  {movement.createdBy?.role && (
                    <span className="text-[10px] text-[#86868B]">
                      {movement.createdBy.role}
                    </span>
                  )}
                </div>

                <div className="rounded-xl border border-[#E8E8ED] p-2.5 dark:border-[#2C2C2E]">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                    Date & Time
                  </span>
                  <span className="mt-1 block text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {formatDate(movement.createdAt)}
                  </span>
                </div>

                {movement.costPrice !== undefined && movement.costPrice !== null && (
                  <div className="rounded-xl border border-[#E8E8ED] p-2.5 dark:border-[#2C2C2E]">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                      Unit Cost
                    </span>
                    <span className="mt-1 block font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {formatCurrency(movement.costPrice)}
                    </span>
                  </div>
                )}
              </div>

              {/* Batch Reference & Note */}
              {(movement.stockBatch?.reference || movement.note) && (
                <div className="rounded-xl border border-[#E8E8ED] p-3 text-xs dark:border-[#2C2C2E] space-y-1.5">
                  {movement.stockBatch?.reference && (
                    <div>
                      <span className="font-semibold text-[#6E6E73]">Batch Ref: </span>
                      <span className="font-mono text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {movement.stockBatch.reference}
                      </span>
                    </div>
                  )}
                  {movement.note && (
                    <div>
                      <span className="font-semibold text-[#6E6E73]">Note: </span>
                      <span className="text-[#1D1D1F] dark:text-[#F5F5F7] italic">
                        {movement.note}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Serialized Units Table */}
              {movement.product.trackingType === 'SERIALIZED' && movement.units && movement.units.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                      Associated Units ({movement.units.length})
                    </span>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-[#E8E8ED] dark:border-[#2C2C2E]">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-[#E8E8ED] bg-[#F5F5F7] text-[#86868B] dark:border-[#2C2C2E] dark:bg-[#2C2C2E]">
                          <th className="px-2.5 py-1.5 text-left font-semibold">IMEI / Serial</th>
                          <th className="px-2.5 py-1.5 text-left font-semibold">Storage</th>
                          <th className="px-2.5 py-1.5 text-left font-semibold">Color</th>
                          <th className="px-2.5 py-1.5 text-left font-semibold">Location</th>
                          <th className="px-2.5 py-1.5 text-left font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8E8ED] dark:divide-[#2C2C2E]">
                        {movement.units.map((u) => (
                          <tr key={u.id} className="hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]">
                            <td className="px-2.5 py-1.5 font-mono font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                              {u.imei || u.serialNumber || '—'}
                            </td>
                            <td className="px-2.5 py-1.5 text-[#6E6E73]">{u.storage ? `${u.storage}GB` : '—'}</td>
                            <td className="px-2.5 py-1.5 text-[#6E6E73]">{u.color || '—'}</td>
                            <td className="px-2.5 py-1.5 text-[#6E6E73]">{u.location}</td>
                            <td className="px-2.5 py-1.5 font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                              {u.status}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* footer */}
        <div className="flex items-center justify-end border-t border-[#E8E8ED] px-4 py-2.5 dark:border-[#2C2C2E]">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

      </div>
    </div>
  );
};
