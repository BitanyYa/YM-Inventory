'use client';

import React, { useEffect, useState } from 'react';
import { UnitHistoryResponse, UnitHistoryMovementItem } from '../../types/api';
import { productService } from '../../services/product.service';
import { formatCurrency, formatDate } from '../../lib/utils';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { CloseIcon, AlertTriangleIcon } from '../ui/Icons';

interface UnitDetailsModalProps {
  unitId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

function unitStatusVariant(status: string) {
  switch (status) {
    case 'AVAILABLE': return 'success' as const;
    case 'IN_SHOP': return 'info' as const;
    case 'SOLD': return 'neutral' as const;
    case 'RETURNED': return 'warning' as const;
    case 'DAMAGED':
    case 'UNACCOUNTED': return 'danger' as const;
    default: return 'neutral' as const;
  }
}

function unitStatusLabel(status: string): string {
  switch (status) {
    case 'AVAILABLE': return 'Available';
    case 'IN_SHOP': return 'In Shop';
    case 'SOLD': return 'Sold';
    case 'RETURNED': return 'Returned';
    case 'DAMAGED': return 'Damaged';
    case 'UNACCOUNTED': return 'Unaccounted';
    default: return status.replace('_', ' ');
  }
}

function movementBadgeVariant(type: string) {
  switch (type) {
    case 'STOCK_IN': return 'info' as const;
    case 'TRANSFER': return 'neutral' as const;
    case 'SALE': return 'success' as const;
    case 'RETURN': return 'warning' as const;
    case 'DAMAGE':
    case 'LOSS': return 'danger' as const;
    case 'ADJUSTMENT': return 'warning' as const;
    default: return 'neutral' as const;
  }
}

function locationFlow(m: UnitHistoryMovementItem): string {
  if (m.movementType === 'STOCK_IN') return `→ ${m.toLocation ?? 'Warehouse'}`;
  if (m.movementType === 'TRANSFER') return `${m.fromLocation ?? 'Warehouse'} → ${m.toLocation ?? 'Shop'}`;
  if (m.movementType === 'SALE') return `${m.fromLocation ?? 'Shop'} → Sold`;
  if (m.movementType === 'RETURN') return `Sold → ${m.toLocation ?? 'Warehouse'}`;
  if (m.movementType === 'DAMAGE' || m.movementType === 'LOSS') return `${m.fromLocation ?? '—'} → —`;
  if (m.movementType === 'ADJUSTMENT') return m.fromLocation ? `${m.fromLocation}` : (m.toLocation ?? '—');
  return [m.fromLocation, m.toLocation].filter(Boolean).join(' → ') || '—';
}

function adjustmentDirection(note?: string | null): { isSurplus: boolean; isShortage: boolean; text: string } | null {
  if (!note) return null;
  if (note.includes('+') || note.toLowerCase().includes('surplus')) {
    return { isSurplus: true, isShortage: false, text: '+Surplus' };
  }
  if (note.includes('-') || note.toLowerCase().includes('shortage')) {
    return { isSurplus: false, isShortage: true, text: '-Shortage' };
  }
  return null;
}

export const UnitDetailsModal: React.FC<UnitDetailsModalProps> = ({
  unitId,
  isOpen,
  onClose,
}) => {
  const [data, setData] = useState<UnitHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !unitId) {
      setData(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    productService
      .getUnitHistory(unitId)
      .then((res) => {
        if (isMounted) {
          setData(res);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError((err as { message?: string })?.message ?? 'Failed to load unit details.');
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
  }, [isOpen, unitId]);

  if (!isOpen) return null;

  const unit = data?.unit;
  const primaryId = unit?.imei ? `IMEI: ${unit.imei}` : unit?.serialNumber ? `Serial: ${unit.serialNumber}` : 'Unit Overview';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative my-6 flex w-full max-w-3xl flex-col rounded-2xl border border-[#E2E8F0] bg-white shadow-xl dark:border-[#334155] dark:bg-[#1E293B]">

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#F1F5F9] px-5 py-4 dark:border-[#334155]">
          <div>
            <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">Unit Details</h3>
            <p className="text-xs font-semibold text-[#2563EB]">{primaryId}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] dark:hover:bg-[#334155] dark:hover:text-[#F8FAFC]"
            aria-label="Close modal"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="overflow-y-auto p-5 space-y-5" style={{ maxHeight: 'calc(85vh - 120px)' }}>

          {isLoading ? (
            <div className="space-y-4 py-8">
              <div className="h-20 w-full animate-pulse rounded-2xl bg-[#EFF6FF]/60 dark:bg-[#334155]" />
              <div className="h-40 w-full animate-pulse rounded-2xl bg-[#F1F5F9] dark:bg-[#334155]" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FEE2E2] text-[#DC2626]">
                <AlertTriangleIcon size={20} />
              </div>
              <p className="text-xs font-semibold text-[#991B1B]">{error}</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (unitId) {
                    setIsLoading(true);
                    setError(null);
                    productService.getUnitHistory(unitId).then(setData).catch((err: unknown) => setError((err as { message?: string })?.message ?? 'Failed to load')).finally(() => setIsLoading(false));
                  }
                }}
              >
                Retry
              </Button>
            </div>
          ) : unit ? (
            <>
              {/* Product Overview Summary Strip */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#EFF6FF]/40 p-4 dark:border-[#334155] dark:bg-[#0F172A]">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 text-xs">
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Product</span>
                    <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate block">{unit.product?.name ?? '—'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Brand / Category</span>
                    <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                      {unit.product?.brand ?? '—'} {unit.product?.category?.name ? `· ${unit.product.category.name}` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Current Location</span>
                    <Badge variant="info" size="sm" className="mt-0.5 font-bold">
                      {unit.location === 'WAREHOUSE' ? 'Warehouse' : 'Shop'}
                    </Badge>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Status</span>
                    <Badge variant={unitStatusVariant(unit.status)} size="sm" className="mt-0.5 font-bold">
                      {unitStatusLabel(unit.status)}
                    </Badge>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-[#CBD5E1]/40 dark:border-[#334155] grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 text-xs">
                  {unit.imei && (
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B]">IMEI</span>
                      <span className="font-mono font-semibold text-[#0F172A] dark:text-[#F8FAFC]">{unit.imei}</span>
                    </div>
                  )}
                  {unit.serialNumber && (
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Serial Number</span>
                      <span className="font-mono font-semibold text-[#0F172A] dark:text-[#F8FAFC]">{unit.serialNumber}</span>
                    </div>
                  )}
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Specs</span>
                    <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                      {[unit.storage ? `${unit.storage} GB` : null, unit.color].filter(Boolean).join(' / ') || '—'}
                    </span>
                  </div>
                  {unit.purchasePrice != null && (
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Purchase Price</span>
                      <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">{formatCurrency(unit.purchasePrice)}</span>
                    </div>
                  )}
                  {unit.createdAt && (
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Date Received</span>
                      <span className="font-medium text-[#64748B]">{formatDate(unit.createdAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Lifecycle History Timeline */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">Lifecycle History</h4>
                  <span className="text-[11px] font-semibold text-[#64748B]">
                    {data?.history.length ?? 0} transaction{(data?.history.length ?? 0) !== 1 ? 's' : ''}
                  </span>
                </div>

                {!data?.history || data.history.length === 0 ? (
                  <div className="rounded-xl border border-[#E2E8F0] p-6 text-center text-xs font-semibold text-[#64748B] dark:border-[#334155]">
                    No stock movements recorded for this unit yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-[#E2E8F0] bg-white shadow-xs dark:border-[#334155] dark:bg-[#1E293B]">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC] text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:border-[#334155] dark:bg-[#0F172A]">
                          <th className="px-3.5 py-2.5">Date</th>
                          <th className="px-3 py-2.5">Operation</th>
                          <th className="px-3 py-2.5">Flow</th>
                          <th className="px-3 py-2.5">Performed By</th>
                          <th className="px-3 py-2.5 text-right">Cost</th>
                          <th className="px-3.5 py-2.5">Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#334155]">
                        {data.history.map((m) => {
                          const adj = adjustmentDirection(m.note);
                          return (
                            <tr key={m.movementId} className="hover:bg-[#EFF6FF]/40 dark:hover:bg-[#334155]/40">
                              <td className="px-3.5 py-2.5 font-medium whitespace-nowrap text-[#64748B]">
                                {formatDate(m.createdAt)}
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-1">
                                  <Badge variant={movementBadgeVariant(m.movementType)} size="sm">
                                    {m.movementType.replace('_', ' ')}
                                  </Badge>
                                  {adj && (
                                    <Badge variant={adj.isSurplus ? 'success' : 'danger'} size="sm">
                                      {adj.text}
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                                {locationFlow(m)}
                              </td>
                              <td className="px-3 py-2.5 font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                                {m.createdBy?.name ?? 'System'}
                              </td>
                              <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">
                                {m.costPrice != null ? formatCurrency(m.costPrice) : '—'}
                              </td>
                              <td className="px-3.5 py-2.5 text-[#64748B] max-w-[180px] truncate">
                                {m.note ?? '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : null}

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end border-t border-[#F1F5F9] px-5 py-3 dark:border-[#334155]">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

      </div>
    </div>
  );
};
