'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { inventoryService } from '../../services/inventory.service';
import { categoryService } from '../../services/category.service';
import {
  Category, InventoryProductItem, InventoryStockStatus, PaginationMeta, TrackingType,
} from '../../types/api';
import { AppShell } from '../../components/layout/AppShell';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { SearchIcon, AlertTriangleIcon, InventoryIcon } from '../../components/ui/Icons';
import { ReceiveStockModal } from '../../components/inventory/ReceiveStockModal';
import { TransferStockModal } from '../../components/inventory/TransferStockModal';
import { SellStockModal } from '../../components/inventory/SellStockModal';
import { ReturnStockModal } from '../../components/inventory/ReturnStockModal';
import { DamageLossModal } from '../../components/inventory/DamageLossModal';

type ModalType = 'receive' | 'transfer' | 'sell' | 'return' | 'damage' | null;

function StockBadge({ status }: { status: InventoryStockStatus }) {
  if (status === 'IN_STOCK') return <Badge variant="success" size="sm">In Stock</Badge>;
  if (status === 'LOW_STOCK') return <Badge variant="warning" size="sm">Low Stock</Badge>;
  return <Badge variant="danger" size="sm">Out of Stock</Badge>;
}

function SkeletonRow() {
  return (
    <tr>
      {[55, 35, 20, 15, 15, 18, 22, 16].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-4 animate-pulse rounded bg-[#F5F5F7] dark:bg-[#2C2C2E]" style={{ width: `${w}%` }} />
        </td>
      ))}
    </tr>
  );
}

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
      <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)} onBlur={() => setTimeout(() => setOpen(false), 150)}>
        Manage ▾
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-[#E8E8ED] bg-white shadow-lg dark:border-[#38383A] dark:bg-[#1C1C1E]">
          {items.map((a) => (
            <button
              key={a.type}
              onMouseDown={() => { setOpen(false); onAction(a.type, product); }}
              className={`block w-full px-4 py-2.5 text-left text-xs font-medium transition-colors ${
                a.danger
                  ? 'text-[#FF3B30] hover:bg-[#FFECEB] dark:text-[#FF453A] dark:hover:bg-[#2E0A09]'
                  : 'text-[#1D1D1F] hover:bg-[#F5F5F7] dark:text-[#F5F5F7] dark:hover:bg-[#2C2C2E]'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function InventoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'PRIMARY_ADMIN';

  const [products, setProducts] = useState<InventoryProductItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [summary, setSummary] = useState<{ totalProducts: number; warehouseUnits: number; shopUnits: number } | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState<'ALL' | 'WAREHOUSE' | 'SHOP'>('ALL');
  const [categoryId, setCategoryId] = useState('');
  const [stockStatus, setStockStatus] = useState<InventoryStockStatus | ''>('');
  const [trackingType, setTrackingType] = useState<TrackingType | ''>('');
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedProduct, setSelectedProduct] = useState<InventoryProductItem | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchCategories = useCallback(async () => {
    try { setCategories((await categoryService.getCategories()) || []); } catch { /* non-critical */ }
  }, []);
  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await inventoryService.getInventorySummary();
      setSummary({ totalProducts: res.data.totalProducts, warehouseUnits: res.data.warehouseUnits, shopUnits: res.data.shopUnits });
    } catch { /* non-critical */ }
  }, []);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const fetchInventory = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const res = await inventoryService.getInventory({
        page, limit: 20, search: debouncedSearch,
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
    } finally { setIsLoading(false); }
  }, [page, debouncedSearch, categoryId, locationFilter, stockStatus, trackingType]);
  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  const showSuccess = (msg: string) => { setSuccessBanner(msg); setTimeout(() => setSuccessBanner(null), 4000); };
  const handleOperationSuccess = (action: string) => { showSuccess(`${action} recorded.`); fetchInventory(); fetchSummary(); };
  const openModal = (type: ModalType, p: InventoryProductItem) => { setSelectedProduct(p); setActiveModal(type); };
  const closeModal = () => { setActiveModal(null); setSelectedProduct(null); };

  const resetFilters = () => {
    setSearch(''); setDebouncedSearch(''); setLocationFilter('ALL');
    setCategoryId(''); setStockStatus(''); setTrackingType(''); setPage(1);
  };
  const hasActiveFilters = !!(debouncedSearch || locationFilter !== 'ALL' || categoryId || stockStatus || trackingType);

  const selectCls = 'rounded-lg border border-[#D2D2D7] bg-white px-3 py-1.5 text-xs font-medium text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/50 focus:border-[#0071E3] dark:border-[#38383A] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]';

  return (
    <AppShell>
      <div className="space-y-3">

        {/* header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Inventory</h2>
            <p className="text-xs text-[#6E6E73]">Live stock levels across warehouse and shop.</p>
          </div>
        </div>

        {/* banners */}
        {successBanner && (
          <div className="flex items-center justify-between rounded-lg border border-[#30D158]/30 bg-[#E9F9EE] px-3 py-2 text-xs font-medium text-[#1A7A3A] dark:border-[#30D158]/20 dark:bg-[#0A2E1A] dark:text-[#30D158]">
            <span>{successBanner}</span>
            <button onClick={() => setSuccessBanner(null)}>✕</button>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-between rounded-lg border border-[#FF3B30]/20 bg-[#FFECEB] px-3 py-2 text-xs text-[#CC2B22] dark:border-[#FF453A]/20 dark:bg-[#2E0A09] dark:text-[#FF453A]">
            <div className="flex items-center gap-2"><AlertTriangleIcon size={14} className="shrink-0" />{error}</div>
            <Button variant="secondary" size="sm" onClick={fetchInventory}>Retry</Button>
          </div>
        )}

        {/* summary */}
        {summary && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Total Products', value: summary.totalProducts },
              { label: 'Warehouse', value: summary.warehouseUnits },
              { label: 'Shop Floor', value: summary.shopUnits },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-[#E8E8ED] bg-white px-3 py-2.5 dark:border-[#38383A] dark:bg-[#1C1C1E]">
                <p className="text-[10px] font-medium text-[#86868B]">{s.label}</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">{s.value.toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}

        {/* category pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {[{ id: '', name: 'All' }, ...categories].map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setCategoryId(cat.id); setPage(1); }}
              className={`shrink-0 rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                categoryId === cat.id
                  ? 'bg-[#0071E3] text-white'
                  : 'border border-[#D2D2D7] bg-white text-[#1D1D1F] hover:bg-[#F5F5F7] dark:border-[#38383A] dark:bg-[#1C1C1E] dark:text-[#F5F5F7] dark:hover:bg-[#2C2C2E]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* filter bar */}
        <div className="flex flex-col gap-2 rounded-xl border border-[#E8E8ED] bg-white p-2.5 dark:border-[#38383A] dark:bg-[#1C1C1E] sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <SearchIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#AEAEB2]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              className="w-full rounded-lg border border-[#D2D2D7] bg-[#F5F5F7] py-1.5 pl-8 pr-3 text-xs text-[#1D1D1F] placeholder:text-[#AEAEB2] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/50 focus:border-[#0071E3] dark:border-[#38383A] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <select value={locationFilter} onChange={(e) => { setLocationFilter(e.target.value as typeof locationFilter); setPage(1); }} className={selectCls}>
              <option value="ALL">All Locations</option>
              <option value="WAREHOUSE">Warehouse</option>
              <option value="SHOP">Shop</option>
            </select>
            <select value={stockStatus} onChange={(e) => { setStockStatus(e.target.value as InventoryStockStatus | ''); setPage(1); }} className={selectCls}>
              <option value="">All Status</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
            </select>
            <select value={trackingType} onChange={(e) => { setTrackingType(e.target.value as TrackingType | ''); setPage(1); }} className={selectCls}>
              <option value="">All Tracking</option>
              <option value="QUANTITY">Quantity</option>
              <option value="SERIALIZED">Serialized</option>
            </select>
            <button onClick={resetFilters} disabled={!hasActiveFilters}
              className={`${selectCls} disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F5F5F7]`}>
              Clear
            </button>
          </div>
        </div>

        {/* table */}
        <div className="rounded-xl border border-[#E8E8ED] bg-white dark:border-[#38383A] dark:bg-[#1C1C1E]">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 w-full animate-pulse rounded-lg bg-[#F5F5F7] dark:bg-[#2C2C2E]" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <InventoryIcon size={24} className="text-[#D2D2D7]" />
              <h3 className="mt-3 text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">No products found</h3>
              <p className="mt-1 text-xs text-[#6E6E73]">No inventory items match your current filters.</p>
              {hasActiveFilters && <Button variant="secondary" size="sm" onClick={resetFilters} className="mt-3">Reset Filters</Button>}
            </div>
          ) : (
            <>
              {/* desktop */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#E8E8ED] bg-[#F5F5F7] dark:border-[#38383A] dark:bg-[#2C2C2E]">
                      {['Product', 'Category', 'Warehouse', 'Shop', 'Total', 'Status', 'Tracking', ''].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider text-[#86868B]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5F5F7] dark:divide-[#2C2C2E]">
                    {isLoading
                      ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                      : products.map((p) => (
                        <tr key={p.id} className="hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]">
                          <td className="px-4 py-3">
                            <Link href={`/products/${p.id}`} className="font-semibold text-[#1D1D1F] hover:text-[#0071E3] dark:text-[#F5F5F7]">
                              {p.name}
                            </Link>
                            {p.brand && <span className="block text-[11px] text-[#86868B]">{p.brand}</span>}
                          </td>
                          <td className="px-4 py-3 text-[#6E6E73]">{p.category?.name || '—'}</td>
                          <td className="px-4 py-3 text-center tabular-nums font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{p.inventory.warehouseQuantity}</td>
                          <td className="px-4 py-3 text-center tabular-nums font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{p.inventory.shopQuantity}</td>
                          <td className="px-4 py-3 text-center tabular-nums font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">{p.inventory.totalQuantity}</td>
                          <td className="px-4 py-3"><StockBadge status={p.stockStatus} /></td>
                          <td className="px-4 py-3">
                            <Badge variant={p.trackingType === 'SERIALIZED' ? 'info' : 'neutral'} size="sm">
                              {p.trackingType}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <ActionMenu product={p} isAdmin={isAdmin} onAction={openModal} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* mobile */}
              <div className="divide-y divide-[#F5F5F7] dark:divide-[#2C2C2E] md:hidden">
                {products.map((p) => (
                  <div key={p.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between">
                      <div>
                        <Link href={`/products/${p.id}`} className="text-sm font-semibold text-[#1D1D1F] hover:text-[#0071E3] dark:text-[#F5F5F7]">
                          {p.name}
                        </Link>
                        <span className="block text-xs text-[#86868B]">{[p.brand, p.category?.name].filter(Boolean).join(' · ')}</span>
                      </div>
                      <StockBadge status={p.stockStatus} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-[#F5F5F7] p-2.5 text-xs dark:bg-[#2C2C2E]">
                      <div><span className="block text-[10px] font-medium text-[#86868B]">Warehouse</span><strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{p.inventory.warehouseQuantity}</strong></div>
                      <div className="text-center"><span className="block text-[10px] font-medium text-[#86868B]">Shop</span><strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{p.inventory.shopQuantity}</strong></div>
                      <div className="text-right"><span className="block text-[10px] font-medium text-[#86868B]">Total</span><strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{p.inventory.totalQuantity}</strong></div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge variant={p.trackingType === 'SERIALIZED' ? 'info' : 'neutral'} size="sm">{p.trackingType}</Badge>
                      <ActionMenu product={p} isAdmin={isAdmin} onAction={openModal} />
                    </div>
                  </div>
                ))}
              </div>

              {/* pagination */}
              <div className="flex items-center justify-between border-t border-[#E8E8ED] bg-[#F5F5F7] px-4 py-2.5 dark:border-[#38383A] dark:bg-[#2C2C2E]">
                <span className="text-xs text-[#6E6E73]">Page {meta.page} of {meta.totalPages || 1} ({meta.total} items)</span>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" disabled={page <= 1 || isLoading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
                  <Button variant="secondary" size="sm" disabled={page >= meta.totalPages || isLoading} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            </>
          )}
        </div>

      </div>

      <ReceiveStockModal isOpen={activeModal === 'receive'} product={selectedProduct} onClose={closeModal} onSuccess={() => handleOperationSuccess('Stock receipt')} />
      <TransferStockModal isOpen={activeModal === 'transfer'} product={selectedProduct} onClose={closeModal} onSuccess={() => handleOperationSuccess('Transfer')} />
      <SellStockModal isOpen={activeModal === 'sell'} product={selectedProduct} onClose={closeModal} onSuccess={() => handleOperationSuccess('Sale')} />
      <ReturnStockModal isOpen={activeModal === 'return'} product={selectedProduct} onClose={closeModal} onSuccess={() => handleOperationSuccess('Return')} />
      <DamageLossModal isOpen={activeModal === 'damage'} product={selectedProduct} onClose={closeModal} onSuccess={() => handleOperationSuccess('Adjustment')} />
    </AppShell>
  );
}
