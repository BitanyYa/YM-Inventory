'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { productService } from '../../../services/product.service';
import { inventoryService } from '../../../services/inventory.service';
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
import { formatCurrency, formatDate } from '../../../lib/utils';
import { AlertTriangleIcon } from '../../../components/ui/Icons';

type StockModal = 'receive' | 'transfer' | 'sell' | 'return' | 'damage' | null;

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

  // Cast ProductDetail to InventoryProductItem for modal props
  const productAsInventory = product as unknown as InventoryProductItem;

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (error || !product) {
    return (
      <AppShell>
        <div className="space-y-3">
          <Link href="/products" className="text-xs text-slate-500 hover:text-slate-900">← Back to Products</Link>
          <div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/50">
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

        {/* ── breadcrumb + heading ── */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/products" className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
              ← Products
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{product.name}</h2>
              <Badge variant={product.isActive ? 'success' : 'neutral'} size="sm">
                {product.isActive ? 'Active' : 'Inactive'}
              </Badge>
              <StockBadge status={product.stockStatus} />
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
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
              </>
            )}
            <Button variant="secondary" size="sm" onClick={() => setStockModal('sell')}>$ Sell</Button>
            <Button variant="secondary" size="sm" onClick={() => setStockModal('return')}>↩ Return</Button>
            <Button variant="danger" size="sm" onClick={() => setStockModal('damage')}>⚠ Dmg/Loss</Button>
            {isAdmin && (
              <Button variant="primary" size="sm" onClick={() => setIsEditOpen(true)}>Edit</Button>
            )}
          </div>
        </div>

        {/* ── banners ── */}
        {successBanner && (
          <div className="flex items-center justify-between rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
            <span>{successBanner}</span>
            <button onClick={() => setSuccessBanner(null)}>✕</button>
          </div>
        )}

        {/* ── info + stock row ── */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Selling Price', value: formatCurrency(product.sellingPrice) },
            { label: 'Warehouse', value: inv.warehouseQuantity },
            { label: 'Shop', value: inv.shopQuantity },
            { label: 'Total', value: inv.totalQuantity },
          ].map((s) => (
            <div key={s.label} className="rounded border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{s.label}</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── movement summary + description ── */}
        {(ms || product.description) && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {ms && (
              <div className="rounded border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Movement Summary</span>
                </div>
                <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800">
                  {[
                    { label: 'Stock-In', value: ms.stockIn, color: 'text-sky-600 dark:text-sky-400' },
                    { label: 'Transfers', value: ms.transfers, color: 'text-slate-700 dark:text-slate-300' },
                    { label: 'Sales', value: ms.sales, color: 'text-emerald-600 dark:text-emerald-400' },
                    { label: 'Returns', value: ms.returns, color: 'text-amber-600 dark:text-amber-400' },
                    { label: 'Damages', value: ms.damages, color: 'text-red-600 dark:text-red-400' },
                    { label: 'Losses', value: ms.losses, color: 'text-red-600 dark:text-red-400' },
                  ].map((item) => (
                    <div key={item.label} className="px-3 py-2.5 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{item.label}</p>
                      <p className={`text-base font-bold tabular-nums ${item.color}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {product.description && (
              <div className="rounded border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Description</p>
                <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">{product.description}</p>
              </div>
            )}
          </div>
        )}

        {/* ── serialized units ── */}
        {product.trackingType === 'SERIALIZED' && (
          <div className="rounded border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Serialized Units
                {product.units && <span className="ml-1.5 text-slate-400">({product.units.length})</span>}
              </span>
              {product.unitSummary && (
                <span className="text-[11px] text-slate-500">
                  WH: {product.unitSummary.warehouseAvailable} · Shop: {product.unitSummary.shopAvailable}
                </span>
              )}
            </div>
            {!product.units || product.units.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-400">No units recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60">
                      {['IMEI', 'Serial', 'Storage/Color', 'Location', 'Status', 'Purchase Price'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {product.units.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                        <td className="px-3 py-2 font-mono text-slate-900 dark:text-slate-100">{u.imei ?? '—'}</td>
                        <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-400">{u.serialNumber ?? '—'}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                          {[u.storage, u.color].filter(Boolean).join(' / ') || '—'}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">{u.location}</td>
                        <td className="px-3 py-2"><UnitStatusBadge status={u.status} /></td>
                        <td className="px-3 py-2 tabular-nums text-slate-700 dark:text-slate-300">
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

        {/* ── min stock info strip ── */}
        <div className="flex items-center gap-4 rounded border border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <span>Min stock threshold: <strong className="text-slate-700 dark:text-slate-300">{product.minimumStock}</strong></span>
          <span>Product type: <strong className="text-slate-700 dark:text-slate-300">{product.productType}</strong></span>
          {product.createdAt && <span className="hidden sm:block">Added: <strong className="text-slate-700 dark:text-slate-300">{formatDate(product.createdAt)}</strong></span>}
        </div>

      </div>

      {/* ── modals ── */}
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
    </AppShell>
  );
}
