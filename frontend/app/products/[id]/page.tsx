'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { productService } from '../../../services/product.service';
import { ProductDetail, InventoryProductItem } from '../../../types/api';
import { AppShell } from '../../../components/layout/AppShell';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Spinner } from '../../../components/ui/Spinner';
import { EditProductModal } from '../../../components/products/EditProductModal';
import { ReceiveStockModal } from '../../../components/inventory/ReceiveStockModal';
import { TransferStockModal } from '../../../components/inventory/TransferStockModal';
import { SellStockModal } from '../../../components/inventory/SellStockModal';
import { ReturnStockModal } from '../../../components/inventory/ReturnStockModal';
import { DamageLossModal } from '../../../components/inventory/DamageLossModal';
import { ReconcileStockModal } from '../../../components/inventory/ReconcileStockModal';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { AlertTriangleIcon } from '../../../components/ui/Icons';

type StockModal = 'receive' | 'transfer' | 'sell' | 'return' | 'damage' | 'reconcile' | null;

function StockBadge({ status }: { status: string }) {
  if (status === 'IN_STOCK') return <Badge variant="success" size="sm">In Stock</Badge>;
  if (status === 'LOW_STOCK') return <Badge variant="warning" size="sm">Low Stock</Badge>;
  if (status === 'OUT_OF_STOCK') return <Badge variant="danger" size="sm">Out of Stock</Badge>;
  return <Badge variant="neutral" size="sm">{status}</Badge>;
}

function UnitStatusBadge({ status }: { status: string }) {
  if (status === 'AVAILABLE' || status === 'IN_SHOP') return <Badge variant="success" size="sm">{status}</Badge>;
  if (status === 'SOLD') return <Badge variant="neutral" size="sm">SOLD</Badge>;
  return <Badge variant="danger" size="sm">{status}</Badge>;
}

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.id as string;
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'PRIMARY_ADMIN';

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [stockModal, setStockModal] = useState<StockModal>(null);

  const fetchProduct = useCallback(async () => {
    if (!productId) return;
    setIsLoading(true); setError(null);
    try { setProduct((await productService.getProduct(productId)).data); }
    catch (e: unknown) { setError((e as { message?: string })?.message ?? 'Failed to load product.'); }
    finally { setIsLoading(false); }
  }, [productId]);

  useEffect(() => { fetchProduct(); }, [fetchProduct]);

  const showSuccess = (msg: string) => { setSuccessBanner(msg); setTimeout(() => setSuccessBanner(null), 4000); };
  const handleOpSuccess = (action: string) => { showSuccess(`${action} recorded.`); fetchProduct(); };
  const productAsInventory = product as unknown as InventoryProductItem;

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
      </AppShell>
    );
  }

  if (error || !product) {
    return (
      <AppShell>
        <div className="space-y-3">
          <Link href="/products" className="text-xs text-[#0071E3] hover:text-[#0077ED]">← Back to Products</Link>
          <div className="flex items-center gap-2 rounded-lg border border-[#FF3B30]/20 bg-[#FFECEB] px-4 py-3 text-xs text-[#CC2B22] dark:border-[#FF453A]/20 dark:bg-[#2E0A09] dark:text-[#FF453A]">
            <AlertTriangleIcon size={14} />{error ?? 'Product not found.'}
          </div>
          <Button variant="secondary" size="sm" onClick={fetchProduct}>Retry</Button>
        </div>
      </AppShell>
    );
  }

  const inv = product.inventory;
  const ms = product.movementSummary;

  return (
    <AppShell>
      <div className="space-y-4">

        {/* breadcrumb + heading */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/products" className="text-xs text-[#0071E3] hover:text-[#0077ED]">← Products</Link>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{product.name}</h2>
              <Badge variant={product.isActive ? 'success' : 'neutral'} size="sm">
                {product.isActive ? 'Active' : 'Inactive'}
              </Badge>
              <StockBadge status={product.stockStatus} />
            </div>
            <p className="mt-0.5 text-xs text-[#6E6E73]">
              {product.brand}
              {product.category && <> · {product.category.name}</>}
              {' · '}
              <Badge variant={product.trackingType === 'SERIALIZED' ? 'info' : 'neutral'} size="sm">
                {product.trackingType}
              </Badge>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {isAdmin && (
              <>
                <Button variant="secondary" size="sm" onClick={() => setStockModal('receive')}>+ Receive</Button>
                <Button variant="secondary" size="sm" onClick={() => setStockModal('transfer')}>⇄ Transfer</Button>
                <Button variant="secondary" size="sm" onClick={() => setStockModal('reconcile')}>Reconcile</Button>
              </>
            )}
            <Button variant="secondary" size="sm" onClick={() => setStockModal('sell')}>$ Sell</Button>
            <Button variant="secondary" size="sm" onClick={() => setStockModal('return')}>↩ Return</Button>
            <Button variant="danger" size="sm" onClick={() => setStockModal('damage')}>⚠ Dmg/Loss</Button>
            {isAdmin && <Button variant="primary" size="sm" onClick={() => setIsEditOpen(true)}>Edit</Button>}
          </div>
        </div>

        {/* banners */}
        {successBanner && (
          <div className="flex items-center justify-between rounded-lg border border-[#30D158]/30 bg-[#E9F9EE] px-3 py-2 text-xs font-medium text-[#1A7A3A] dark:border-[#30D158]/20 dark:bg-[#0A2E1A] dark:text-[#30D158]">
            <span>{successBanner}</span>
            <button onClick={() => setSuccessBanner(null)}>✕</button>
          </div>
        )}

        {/* stats row */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Selling Price', value: formatCurrency(product.sellingPrice) },
            { label: 'Warehouse', value: inv.warehouseQuantity },
            { label: 'Shop', value: inv.shopQuantity },
            { label: 'Total', value: inv.totalQuantity },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-[#E8E8ED] bg-white px-3 py-2.5 dark:border-[#38383A] dark:bg-[#1C1C1E]">
              <p className="text-[10px] font-medium text-[#86868B]">{s.label}</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">{s.value}</p>
            </div>
          ))}
        </div>

        {/* movement summary + description */}
        {(ms || product.description) && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {ms && (
              <div className="rounded-xl border border-[#E8E8ED] bg-white dark:border-[#38383A] dark:bg-[#1C1C1E]">
                <div className="border-b border-[#F5F5F7] px-4 py-2.5 dark:border-[#2C2C2E]">
                  <span className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Movement Summary</span>
                </div>
                <div className="grid grid-cols-3 divide-x divide-[#F5F5F7] dark:divide-[#2C2C2E]">
                  {[
                    { label: 'Stock-In', value: ms.stockIn, color: 'text-[#0071E3] dark:text-[#0A84FF]' },
                    { label: 'Transfers', value: ms.transfers, color: 'text-[#1D1D1F] dark:text-[#F5F5F7]' },
                    { label: 'Sales', value: ms.sales, color: 'text-[#30D158]' },
                    { label: 'Returns', value: ms.returns, color: 'text-[#FF9F0A]' },
                    { label: 'Damages', value: ms.damages, color: 'text-[#FF3B30] dark:text-[#FF453A]' },
                    { label: 'Losses', value: ms.losses, color: 'text-[#FF3B30] dark:text-[#FF453A]' },
                  ].map((item) => (
                    <div key={item.label} className="px-3 py-2.5 text-center">
                      <p className="text-[10px] font-medium text-[#86868B]">{item.label}</p>
                      <p className={`text-base font-bold tabular-nums ${item.color}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {product.description && (
              <div className="rounded-xl border border-[#E8E8ED] bg-white px-4 py-3 dark:border-[#38383A] dark:bg-[#1C1C1E]">
                <p className="mb-1.5 text-xs font-semibold text-[#86868B]">Description</p>
                <p className="text-xs leading-relaxed text-[#1D1D1F] dark:text-[#F5F5F7]">{product.description}</p>
              </div>
            )}
          </div>
        )}

        {/* serialized units */}
        {product.trackingType === 'SERIALIZED' && (
          <div className="rounded-xl border border-[#E8E8ED] bg-white dark:border-[#38383A] dark:bg-[#1C1C1E]">
            <div className="flex items-center justify-between border-b border-[#F5F5F7] px-4 py-2.5 dark:border-[#2C2C2E]">
              <span className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Serialized Units
                {product.units && <span className="ml-1.5 text-[#86868B]">({product.units.length})</span>}
              </span>
              {product.unitSummary && (
                <span className="text-[11px] text-[#6E6E73]">
                  WH: {product.unitSummary.warehouseAvailable} · Shop: {product.unitSummary.shopAvailable}
                </span>
              )}
            </div>
            {!product.units || product.units.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-[#86868B]">No units recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#F5F5F7] bg-[#F5F5F7] dark:border-[#2C2C2E] dark:bg-[#2C2C2E]">
                      {['IMEI', 'Serial', 'Storage/Color', 'Location', 'Status', 'Purchase Price'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-[#86868B]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5F5F7] dark:divide-[#2C2C2E]">
                    {product.units.map((u) => (
                      <tr key={u.id} className="hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]">
                        <td className="px-3 py-2 font-mono text-[#1D1D1F] dark:text-[#F5F5F7]">{u.imei ?? '—'}</td>
                        <td className="px-3 py-2 font-mono text-[#6E6E73]">{u.serialNumber ?? '—'}</td>
                        <td className="px-3 py-2 text-[#6E6E73]">{[u.storage, u.color].filter(Boolean).join(' / ') || '—'}</td>
                        <td className="px-3 py-2 font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{u.location}</td>
                        <td className="px-3 py-2"><UnitStatusBadge status={u.status} /></td>
                        <td className="px-3 py-2 tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {u.purchasePrice != null ? formatCurrency(u.purchasePrice) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* info strip */}
        <div className="flex items-center gap-4 rounded-xl border border-[#E8E8ED] bg-[#F5F5F7] px-4 py-2 text-xs text-[#6E6E73] dark:border-[#38383A] dark:bg-[#2C2C2E]">
          <span>Min stock: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{product.minimumStock}</strong></span>
          <span>Type: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{product.productType}</strong></span>
          {product.createdAt && <span className="hidden sm:block">Added: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{formatDate(product.createdAt)}</strong></span>}
        </div>

      </div>

      {/* modals */}
      <EditProductModal product={product} isOpen={isEditOpen} onClose={() => setIsEditOpen(false)}
        onSuccess={() => { showSuccess('Product updated.'); fetchProduct(); }} />
      <ReceiveStockModal isOpen={stockModal === 'receive'} product={productAsInventory}
        onClose={() => setStockModal(null)} onSuccess={() => handleOpSuccess('Receipt')} />
      <TransferStockModal isOpen={stockModal === 'transfer'} product={productAsInventory}
        onClose={() => setStockModal(null)} onSuccess={() => handleOpSuccess('Transfer')} />
      <SellStockModal isOpen={stockModal === 'sell'} product={productAsInventory}
        onClose={() => setStockModal(null)} onSuccess={() => handleOpSuccess('Sale')} />
      <ReturnStockModal isOpen={stockModal === 'return'} product={productAsInventory}
        onClose={() => setStockModal(null)} onSuccess={() => handleOpSuccess('Return')} />
      <DamageLossModal isOpen={stockModal === 'damage'} product={productAsInventory}
        onClose={() => setStockModal(null)} onSuccess={() => handleOpSuccess('Adjustment')} />
      <ReconcileStockModal isOpen={stockModal === 'reconcile'} product={productAsInventory}
        onClose={() => setStockModal(null)} onSuccess={(msg) => handleOpSuccess(msg || 'Reconciliation')} />
    </AppShell>
  );
}
