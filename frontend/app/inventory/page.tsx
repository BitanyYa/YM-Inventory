'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { inventoryService } from '../../services/inventory.service';
import { categoryService } from '../../services/category.service';
import {
  Category,
  InventoryProductItem,
  InventoryStockStatus,
  PaginationMeta,
  TrackingType,
} from '../../types/api';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { SearchIcon, AlertTriangleIcon, InventoryIcon } from '../../components/ui/Icons';
import { ReceiveStockModal } from '../../components/inventory/ReceiveStockModal';
import { TransferStockModal } from '../../components/inventory/TransferStockModal';
import { SellStockModal } from '../../components/inventory/SellStockModal';
import { ReturnStockModal } from '../../components/inventory/ReturnStockModal';
import { DamageLossModal } from '../../components/inventory/DamageLossModal';
import { cn } from '../../lib/utils';

type ModalType = 'receive' | 'transfer' | 'sell' | 'return' | 'damage' | null;

/* ── helpers ── */

function StockBadge({ status }: { status: InventoryStockStatus }) {
  if (status === 'IN_STOCK') return <Badge variant="success" size="sm">In Stock</Badge>;
  if (status === 'LOW_STOCK') return <Badge variant="warning" size="sm">Low Stock</Badge>;
  return <Badge variant="danger" size="sm">Out of Stock</Badge>;
}

/* ── skeleton ── */
function SkeletonRow() {
  return (
    <tr>
      {[55, 35, 20, 15, 15, 18, 22, 16].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div
            className="h-4 animate-pulse rounded bg-slate-100 dark:bg-slate-800"
            style={{ width: `${w}%` }}
          />
        </td>
      ))}
    </tr>
  );
}

/* ── per-row action menu ── */
interface ActionMenuProps {
  product: InventoryProductItem;
  isAdmin: boolean;
  onAction: (type: ModalType, product: InventoryProductItem) => void;
}

function ActionMenu({ product, isAdmin, onAction }: ActionMenuProps) {
  const [open, setOpen] = useState(false);

  const items = [
    { label: 'Receive Stock', type: 'receive' as ModalType, adminOnly: true },
    { label: 'Transfer to Shop', type: 'transfer' as ModalType, adminOnly: true },
    { label: 'Sell', type: 'sell' as ModalType, adminOnly: false },
    { label: 'Return', type: 'return' as ModalType, adminOnly: false },
    { label: 'Damage / Loss', type: 'damage' as ModalType, adminOnly: false, danger: true },
  ].filter((a) => !a.adminOnly || isAdmin);

  return (
    <div className="relative">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      >
        Manage ▾
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
          {items.map((a) => (
            <button
              key={a.type}
              onMouseDown={() => { setOpen(false); onAction(a.type, product); }}
              className={cn(
                'block w-full px-4 py-2.5 text-left text-xs font-medium transition-colors',
                a.danger
                  ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40'
                  : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800',
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════ */

export default function InventoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'PRIMARY_ADMIN';

  /* data */
  const [products, setProducts] = useState<InventoryProductItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [summary, setSummary] = useState<{ totalProducts: number; warehouseUnits: number; shopUnits: number } | null>(null);

  /* filters */
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState<'ALL' | 'WAREHOUSE' | 'SHOP'>('ALL');
  const [categoryId, setCategoryId] = useState('');
  const [stockStatus, setStockStatus] = useState<InventoryStockStatus | ''>('');
  const [trackingType, setTrackingType] = useState<TrackingType | ''>('');
  const [page, setPage] = useState(1);

  /* ui */
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  /* modals */
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedProduct, setSelectedProduct] = useState<InventoryProductItem | null>(null);

  /* debounce */
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  /* categories */
  const fetchCategories = useCallback(async () => {
    try { setCategories((await categoryService.getCategories()) || []); } catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  /* summary */
  const fetchSummary = useCallback(async () => {
    try {
      const res = await inventoryService.getInventorySummary();
      setSummary({ totalProducts: res.data.totalProducts, warehouseUnits: res.data.warehouseUnits, shopUnits: res.data.shopUnits });
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  /* inventory list */
  const fetchInventory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await inventoryService.getInventory({
        page,
        limit: 20,
        search: debouncedSearch,
        categoryId: categoryId || undefined,
        location: locationFilter !== 'ALL' ? locationFilter : undefined,
        stockStatus: stockStatus || undefined,
        trackingType: trackingType || undefined,
        isActive: true,
      });
      setProducts(res.data || []);
      setMeta(res.meta);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to load inventory.');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, categoryId, locationFilter, stockStatus, trackingType]);

  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  /* handlers */
  const showSuccess = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(null), 4000);
  };

  const handleOperationSuccess = (action: string) => {
    showSuccess(`${action} recorded successfully.`);
    fetchInventory();
    fetchSummary();
  };

  const openModal = (type: ModalType, product: InventoryProductItem) => {
    setSelectedProduct(product);
    setActiveModal(type);
  };

  const closeModal = () => { setActiveModal(null); setSelectedProduct(null); };

  const resetFilters = () => {
    setSearch(''); setDebouncedSearch(''); setLocationFilter('ALL');
    setCategoryId(''); setStockStatus(''); setTrackingType(''); setPage(1);
  };

  const hasActiveFilters = !!(debouncedSearch || locationFilter !== 'ALL' || categoryId || stockStatus || trackingType);

  /* ─────────────────────────────────────────────────────────────────────── */
  return (
    <AppShell>
      <div className="space-y-6">

        {/* header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
              Inventory
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Live stock levels across warehouse and shop.
            </p>
          </div>
        </div>

        {/* banners */}
        {successBanner && (
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
            <span>{successBanner}</span>
            <button onClick={() => setSuccessBanner(null)} className="font-bold text-emerald-700 dark:text-emerald-300">✕</button>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
            <div className="flex items-center gap-2">
              <AlertTriangleIcon size={16} className="shrink-0" />
              {error}
            </div>
            <Button variant="secondary" size="sm" onClick={fetchInventory}>Retry</Button>
          </div>
        )}

        {/* summary row — same metric card style as dashboard secondary metrics */}
        {summary && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Products', value: summary.totalProducts, accent: 'border-l-slate-900 dark:border-l-slate-100' },
              { label: 'Warehouse', value: summary.warehouseUnits, accent: 'border-l-emerald-500' },
              { label: 'Shop Floor', value: summary.shopUnits, accent: 'border-l-sky-500' },
            ].map((s) => (
              <Card key={s.label} className={`border-l-4 ${s.accent} p-4`}>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {s.label}
                </span>
                <div className="mt-1.5 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
                  {s.value.toLocaleString()}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* category pills — identical to products page */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
          <button
            onClick={() => { setCategoryId(''); setPage(1); }}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all',
              categoryId === ''
                ? 'bg-slate-900 text-white shadow-xs dark:bg-slate-100 dark:text-slate-900'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
            )}
          >
            All Products
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setCategoryId(cat.id); setPage(1); }}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all',
                categoryId === cat.id
                  ? 'bg-slate-900 text-white shadow-xs dark:bg-slate-100 dark:text-slate-900'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
              )}
            >
              {cat.name}
              {cat.productCount !== undefined && (
                <span className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-bold',
                  categoryId === cat.id
                    ? 'bg-slate-700 text-white dark:bg-slate-300 dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
                )}>
                  {cat.productCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* search + filters — same Card p-4 pattern as products page */}
        <Card className="p-4">
          <div className="flex flex-col gap-3.5">
            {/* search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search by product name or brand..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-400"
              />
              <SearchIcon size={18} className="absolute left-3 top-2.5 text-slate-400" />
            </div>

            {/* filter row */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {/* location */}
              <select
                value={locationFilter}
                onChange={(e) => { setLocationFilter(e.target.value as typeof locationFilter); setPage(1); }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="ALL">All Locations</option>
                <option value="WAREHOUSE">Warehouse</option>
                <option value="SHOP">Shop</option>
              </select>

              {/* stock status */}
              <select
                value={stockStatus}
                onChange={(e) => { setStockStatus(e.target.value as InventoryStockStatus | ''); setPage(1); }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="">All Stock Status</option>
                <option value="IN_STOCK">In Stock</option>
                <option value="LOW_STOCK">Low Stock</option>
                <option value="OUT_OF_STOCK">Out of Stock</option>
              </select>

              {/* tracking type */}
              <select
                value={trackingType}
                onChange={(e) => { setTrackingType(e.target.value as TrackingType | ''); setPage(1); }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="">All Tracking</option>
                <option value="QUANTITY">Quantity</option>
                <option value="SERIALIZED">Serialized</option>
              </select>

              {/* clear */}
              <button
                onClick={resetFilters}
                disabled={!hasActiveFilters}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </Card>

        {/* table card */}
        <Card className="p-0 overflow-hidden">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <InventoryIcon size={24} />
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-slate-100">No products found</h3>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                No inventory items match your current filters.
              </p>
              {hasActiveFilters && (
                <Button variant="secondary" size="sm" onClick={resetFilters} className="mt-4">
                  Reset Filters
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                    <tr>
                      <th className="px-6 py-3.5">Product</th>
                      <th className="px-4 py-3.5">Category</th>
                      <th className="px-4 py-3.5 text-center">Warehouse</th>
                      <th className="px-4 py-3.5 text-center">Shop</th>
                      <th className="px-4 py-3.5 text-center">Total</th>
                      <th className="px-4 py-3.5 text-center">Status</th>
                      <th className="px-4 py-3.5 text-center">Tracking</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {isLoading
                      ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                      : products.map((p) => (
                          <tr
                            key={p.id}
                            className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-900/60"
                          >
                            <td className="px-6 py-4">
                              <Link
                                href={`/products/${p.id}`}
                                className="font-semibold text-slate-900 hover:underline dark:text-slate-100"
                              >
                                {p.name}
                              </Link>
                              {p.brand && (
                                <span className="block text-xs text-slate-500">{p.brand}</span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                              {p.category?.name || '—'}
                            </td>
                            <td className="px-4 py-4 text-center font-bold tabular-nums text-slate-900 dark:text-slate-100">
                              {p.inventory.warehouseQuantity}
                            </td>
                            <td className="px-4 py-4 text-center font-bold tabular-nums text-slate-900 dark:text-slate-100">
                              {p.inventory.shopQuantity}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
                                {p.inventory.totalQuantity}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <StockBadge status={p.stockStatus} />
                            </td>
                            <td className="px-4 py-4 text-center">
                              <Badge variant={p.trackingType === 'SERIALIZED' ? 'info' : 'neutral'} size="sm">
                                {p.trackingType}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <ActionMenu product={p} isAdmin={isAdmin} onAction={openModal} />
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>

              {/* mobile cards — same pattern as products page */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
                {products.map((p) => (
                  <div key={p.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between">
                      <div>
                        <Link
                          href={`/products/${p.id}`}
                          className="text-sm font-bold text-slate-900 hover:underline dark:text-slate-100"
                        >
                          {p.name}
                        </Link>
                        <span className="block text-xs text-slate-500">
                          {[p.brand, p.category?.name].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                      <StockBadge status={p.stockStatus} />
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2.5 text-xs dark:bg-slate-950">
                      <div>
                        <span className="block text-[10px] font-semibold uppercase text-slate-500">Warehouse</span>
                        <strong className="text-sm text-slate-900 dark:text-slate-100">{p.inventory.warehouseQuantity}</strong>
                      </div>
                      <div className="text-center">
                        <span className="block text-[10px] font-semibold uppercase text-slate-500">Shop</span>
                        <strong className="text-sm text-slate-900 dark:text-slate-100">{p.inventory.shopQuantity}</strong>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] font-semibold uppercase text-slate-500">Total</span>
                        <strong className="text-sm text-slate-900 dark:text-slate-100">{p.inventory.totalQuantity}</strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <Badge variant={p.trackingType === 'SERIALIZED' ? 'info' : 'neutral'} size="sm">
                        {p.trackingType}
                      </Badge>
                      <ActionMenu product={p} isAdmin={isAdmin} onAction={openModal} />
                    </div>
                  </div>
                ))}
              </div>

              {/* pagination — same footer style as products page */}
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-950/60">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Page {meta.page} of {meta.totalPages || 1} ({meta.total} items)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1 || isLoading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= meta.totalPages || isLoading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>

      </div>

      {/* modals */}
      <ReceiveStockModal
        isOpen={activeModal === 'receive'}
        product={selectedProduct}
        onClose={closeModal}
        onSuccess={() => handleOperationSuccess('Stock receipt')}
      />
      <TransferStockModal
        isOpen={activeModal === 'transfer'}
        product={selectedProduct}
        onClose={closeModal}
        onSuccess={() => handleOperationSuccess('Transfer')}
      />
      <SellStockModal
        isOpen={activeModal === 'sell'}
        product={selectedProduct}
        onClose={closeModal}
        onSuccess={() => handleOperationSuccess('Sale')}
      />
      <ReturnStockModal
        isOpen={activeModal === 'return'}
        product={selectedProduct}
        onClose={closeModal}
        onSuccess={() => handleOperationSuccess('Return')}
      />
      <DamageLossModal
        isOpen={activeModal === 'damage'}
        product={selectedProduct}
        onClose={closeModal}
        onSuccess={() => handleOperationSuccess('Adjustment')}
      />
    </AppShell>
  );
}
