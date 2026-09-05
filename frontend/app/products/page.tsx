'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { productService } from '../../services/product.service';
import { categoryService } from '../../services/category.service';
import {
  Category, ProductItem, PaginationMeta,
  ProductType, TrackingType, InventoryStockStatus,
} from '../../types/api';
import { AppShell } from '../../components/layout/AppShell';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { CreateProductModal } from '../../components/products/CreateProductModal';
import { EditProductModal } from '../../components/products/EditProductModal';
import { CreateCategoryModal } from '../../components/categories/CreateCategoryModal';
import { EditCategoryModal } from '../../components/categories/EditCategoryModal';
import { ManageCategoriesModal } from '../../components/categories/ManageCategoriesModal';
import { formatCurrency } from '../../lib/utils';
import { SearchIcon, AlertTriangleIcon } from '../../components/ui/Icons';

function StockBadge({ status }: { status: InventoryStockStatus }) {
  if (status === 'IN_STOCK') return <Badge variant="success" size="sm">In Stock</Badge>;
  if (status === 'LOW_STOCK') return <Badge variant="warning" size="sm">Low</Badge>;
  return <Badge variant="danger" size="sm">Out</Badge>;
}

function SkelRow() {
  return (
    <tr>
      {[45, 25, 20, 14, 14, 14, 18, 16, 10].map((w, i) => (
        <td key={i} className="px-3 py-2.5">
          <div className="h-3.5 animate-pulse rounded bg-[#F5F5F7] dark:bg-[#2C2C2E]" style={{ width: `${w}%` }} />
        </td>
      ))}
    </tr>
  );
}

interface ProductActionMenuProps {
  product: ProductItem;
  isAdmin: boolean;
  onEdit: (product: ProductItem) => void;
  onToggleStatus: (product: ProductItem) => void;
}

function ProductActionMenu({ product, isAdmin, onEdit, onToggleStatus }: ProductActionMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [coords, setCoords] = React.useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const updateCoords = React.useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const actualMenuHeight = menuRef.current?.offsetHeight || 160;
      const spaceBelow = window.innerHeight - rect.bottom;
      const right = Math.max(10, window.innerWidth - rect.right);

      if (spaceBelow < actualMenuHeight && rect.top > spaceBelow) {
        setCoords({ bottom: Math.max(10, window.innerHeight - rect.top + 4), right });
      } else {
        setCoords({ top: Math.min(rect.bottom + 4, Math.max(10, window.innerHeight - actualMenuHeight - 10)), right });
      }
    }
  }, []);

  const toggle = () => {
    if (!open) { updateCoords(); setOpen(true); }
    else setOpen(false);
  };

  React.useEffect(() => {
    if (!open) return;
    updateCoords();
    const handleScrollOrResize = () => setOpen(false);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [open, updateCoords]);

  React.useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <>
      <Button ref={buttonRef} variant="secondary" size="sm" onClick={toggle}>
        Manage ▾
      </Button>
      {open && coords && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: coords.top !== undefined ? `${coords.top}px` : undefined,
            bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
            right: `${coords.right}px`,
          }}
          className="z-50 w-36 overflow-hidden rounded-xl border border-[#E8E8ED] bg-white shadow-xl dark:border-[#38383A] dark:bg-[#1C1C1E]"
        >
          <Link
            href={`/products/${product.id}`}
            className="block px-3 py-2 text-left text-xs font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] dark:text-[#F5F5F7] dark:hover:bg-[#2C2C2E]"
            onClick={() => setOpen(false)}
          >
            View Product
          </Link>
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => { setOpen(false); onEdit(product); }}
                className="block w-full px-3 py-2 text-left text-xs font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] dark:text-[#F5F5F7] dark:hover:bg-[#2C2C2E]"
              >
                Edit Product
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); onToggleStatus(product); }}
                className={`block w-full px-3 py-2 text-left text-xs font-medium transition-colors ${
                  product.isActive
                    ? 'text-[#FF3B30] hover:bg-[#FFECEB] dark:text-[#FF453A] dark:hover:bg-[#2E0A09]'
                    : 'text-[#30D158] hover:bg-[#E9F9EE] dark:text-[#30D158] dark:hover:bg-[#0A2E1A]'
                }`}
              >
                {product.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}

export default function ProductsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 25, total: 0, totalPages: 0 });

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [productType, setProductType] = useState<ProductType | ''>('');
  const [trackingType, setTrackingType] = useState<TrackingType | ''>('');
  const [categoryId, setCategoryId] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState('true');
  const [stockStatusFilter, setStockStatusFilter] = useState<InventoryStockStatus | ''>('');
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  const [isCreateProductOpen, setIsCreateProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [statusToggleProduct, setStatusToggleProduct] = useState<ProductItem | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchCategories = useCallback(async () => {
    try { setCategories((await categoryService.getCategories()) ?? []); } catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const fetchProducts = useCallback(async () => {
    const currentReqId = ++reqIdRef.current;
    if (products.length === 0) {
      setIsLoading(true);
    }
    setIsFetching(true);
    setError(null);
    try {
      const isActive = isActiveFilter === 'true' ? true : isActiveFilter === 'false' ? false : undefined;
      const res = await productService.getProducts({
        page, limit: 25,
        search: debouncedSearch,
        productType: productType || undefined,
        trackingType: trackingType || undefined,
        categoryId: categoryId || undefined,
        isActive,
        stockStatus: stockStatusFilter || undefined,
      });
      if (currentReqId === reqIdRef.current) {
        setProducts(res.data ?? []);
        setMeta(res.meta);
      }
    } catch (e: unknown) {
      if (currentReqId === reqIdRef.current) {
        setError((e as { message?: string })?.message ?? 'Failed to load products.');
      }
    } finally {
      if (currentReqId === reqIdRef.current) {
        setIsLoading(false);
        setIsFetching(false);
      }
    }
  }, [page, debouncedSearch, productType, trackingType, categoryId, isActiveFilter, stockStatusFilter, products.length]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const showSuccess = (msg: string) => { setSuccessBanner(msg); setTimeout(() => setSuccessBanner(null), 4000); };
  const resetFilters = () => { setSearch(''); setProductType(''); setTrackingType(''); setCategoryId(''); setIsActiveFilter('true'); setStockStatusFilter(''); setPage(1); };
  const hasFilters = !!(debouncedSearch || productType || trackingType || categoryId || stockStatusFilter || isActiveFilter !== 'true');

  const handleConfirmStatusToggle = async () => {
    if (!statusToggleProduct) return;
    setStatusLoading(true);
    try {
      const nextState = !statusToggleProduct.isActive;
      await productService.updateProductStatus(statusToggleProduct.id, nextState);
      showSuccess(`Product "${statusToggleProduct.name}" ${nextState ? 'activated' : 'deactivated'}.`);
      setStatusToggleProduct(null);
      fetchProducts();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to update product status.');
    } finally {
      setStatusLoading(false);
    }
  };

  /* shared input/select class */
  const inputCls = 'rounded-xl border border-[#CBD5E1] bg-[#EFF6FF]/60 px-3 py-1.5 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40 focus:border-[#2563EB] dark:border-[#475569] dark:bg-[#1E293B] dark:text-[#F8FAFC]';

  return (
    <AppShell>
      <div className="space-y-3">

        {/* header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">Product Catalog</h2>
            <p className="text-xs font-semibold text-[#64748B]">
              {meta.total} product{meta.total !== 1 ? 's' : ''}{hasFilters ? ' (filtered)' : ''}
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setIsManageCategoriesOpen(true)}>Manage Categories</Button>
              <Button variant="primary" size="sm" onClick={() => setIsCreateProductOpen(true)}>+ Product</Button>
            </div>
          )}
        </div>

        {/* banners */}
        {successBanner && (
          <div className="flex items-center justify-between rounded-xl border border-[#10B981]/30 bg-[#ECFDF5] px-3 py-2 text-xs font-semibold text-[#065F46] dark:border-[#10B981]/20 dark:bg-[#022C22] dark:text-[#34D399]">
            <span>{successBanner}</span>
            <button onClick={() => setSuccessBanner(null)}>✕</button>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-between rounded-xl border border-[#DC2626]/20 bg-[#FEE2E2] px-3 py-2 text-xs font-semibold text-[#991B1B] dark:border-[#DC2626]/20 dark:bg-[#450A0A] dark:text-[#F87171]">
            <div className="flex items-center gap-2"><AlertTriangleIcon size={14} />{error}</div>
            <Button variant="secondary" size="sm" onClick={fetchProducts}>Retry</Button>
          </div>
        )}

        {/* category pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {[{ id: '', name: 'All Categories' }, ...categories].map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setCategoryId(cat.id); setPage(1); }}
              className={`shrink-0 rounded-xl px-3 py-1 text-xs font-semibold transition-colors ${
                categoryId === cat.id
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'border border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#EFF6FF] dark:border-[#475569] dark:bg-[#1E293B] dark:text-[#F8FAFC] dark:hover:bg-[#334155]'
              }`}
            >
              {cat.name}
              {'productCount' in cat && cat.productCount !== undefined && (
                <span className={`ml-1.5 text-[10px] ${categoryId === cat.id ? 'opacity-90' : 'text-[#64748B]'}`}>
                  {cat.productCount}
                </span>
              )}
            </button>
          ))}
          {isAdmin && (
            <button
              onClick={() => setIsCreateCategoryOpen(true)}
              className="shrink-0 rounded-xl border border-dashed border-[#CBD5E1] px-3 py-1 text-xs font-semibold text-[#64748B] hover:border-[#2563EB] hover:text-[#2563EB] dark:border-[#475569] dark:hover:border-[#60A5FA] dark:hover:text-[#60A5FA]"
            >
              + Category
            </button>
          )}
        </div>

        {/* filter bar */}
        <div className="flex flex-col gap-2 rounded-2xl border border-[#E2E8F0] bg-white p-2.5 shadow-xs dark:border-[#334155] dark:bg-[#1E293B] sm:flex-row sm:items-center">
          <div className="relative min-w-[280px] sm:min-w-[360px] md:min-w-[400px] flex-1">
            <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by name or brand…"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl border border-[#CBD5E1] bg-[#EFF6FF]/60 py-1.5 pl-8 pr-8 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40 focus:border-[#2563EB] dark:border-[#475569] dark:bg-[#1E293B] dark:text-[#F8FAFC]"
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(1); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] text-xs font-bold px-1"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              {
                value: productType, onChange: (v: string) => { setProductType(v as ProductType | ''); setPage(1); },
                options: [{ label: 'All Types', value: '' }, { label: 'Phone', value: 'PHONE' }, { label: 'Accessory', value: 'ACCESSORY' }, { label: 'Tablet', value: 'TABLET' }, { label: 'Laptop', value: 'LAPTOP' }, { label: 'Smart Watch', value: 'SMART_WATCH' }, { label: 'Other', value: 'OTHER' }],
              },
              {
                value: trackingType, onChange: (v: string) => { setTrackingType(v as TrackingType | ''); setPage(1); },
                options: [{ label: 'All Tracking', value: '' }, { label: 'Quantity', value: 'QUANTITY' }, { label: 'Serialized', value: 'SERIALIZED' }],
              },
              {
                value: stockStatusFilter, onChange: (v: string) => { setStockStatusFilter(v as InventoryStockStatus | ''); setPage(1); },
                options: [{ label: 'All Status', value: '' }, { label: 'In Stock', value: 'IN_STOCK' }, { label: 'Low Stock', value: 'LOW_STOCK' }, { label: 'Out of Stock', value: 'OUT_OF_STOCK' }],
              },
              {
                value: isActiveFilter, onChange: (v: string) => { setIsActiveFilter(v); setPage(1); },
                options: [{ label: 'Active', value: 'true' }, { label: 'Inactive', value: 'false' }, { label: 'All Statuses', value: 'all' }],
              },
            ].map((sel, i) => (
              <Select
                key={i}
                size="sm"
                className="w-32"
                value={sel.value}
                options={sel.options}
                onChange={sel.onChange}
              />
            ))}
            {hasFilters && (
              <button onClick={resetFilters} className="rounded-xl border border-[#D2D2D7] bg-white px-2.5 py-1.5 text-xs text-[#1D1D1F] hover:bg-[#F5F5F7] dark:border-[#38383A] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]">Clear</button>
            )}
          </div>
        </div>

        {/* table */}
        <div className="rounded-xl border border-[#E8E8ED] bg-white dark:border-[#38383A] dark:bg-[#1C1C1E]">
          {/* desktop */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#E8E8ED] bg-[#F5F5F7] dark:border-[#38383A] dark:bg-[#2C2C2E]">
                  {['Product', 'Category', 'Type', 'WH', 'Shop', 'Total', 'Status', 'Price', ''].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider text-[#86868B]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y divide-[#F5F5F7] dark:divide-[#2C2C2E] transition-opacity duration-150 ${isFetching && !isLoading ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
                {isLoading
                  ? Array.from({ length: 8 }).map((_, i) => <SkelRow key={i} />)
                  : products.length === 0
                  ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <AlertTriangleIcon size={20} className="text-[#D2D2D7]" />
                          <p className="text-xs font-medium text-[#6E6E73]">No products found</p>
                          {hasFilters && <button onClick={resetFilters} className="text-xs text-[#0071E3]">Clear filters</button>}
                        </div>
                      </td>
                    </tr>
                  )
                  : products.map((p) => (
                    <tr key={p.id} className="hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]">
                      <td className="px-3 py-2.5">
                        <Link href={`/products/${p.id}`} className="font-semibold text-[#1D1D1F] hover:text-[#0071E3] dark:text-[#F5F5F7]">
                          {p.name}
                        </Link>
                        <span className="block text-[11px] text-[#86868B]">{p.brand}</span>
                      </td>
                      <td className="px-3 py-2.5 text-[#6E6E73]">{p.category?.name ?? '—'}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant={p.trackingType === 'SERIALIZED' ? 'info' : 'neutral'} size="sm">
                          {p.trackingType === 'SERIALIZED' ? 'Serial' : 'Qty'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{p.inventory.warehouseQuantity}</td>
                      <td className="px-3 py-2.5 tabular-nums font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{p.inventory.shopQuantity}</td>
                      <td className="px-3 py-2.5 tabular-nums font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">{p.inventory.totalQuantity}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <StockBadge status={p.stockStatus} />
                          {!p.isActive && <Badge variant="neutral" size="sm">Inactive</Badge>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">{formatCurrency(p.sellingPrice)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <ProductActionMenu
                          product={p}
                          isAdmin={isAdmin}
                          onEdit={(prod) => setEditingProduct(prod)}
                          onToggleStatus={(prod) => setStatusToggleProduct(prod)}
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* mobile */}
          <div className={`divide-y divide-[#F5F5F7] dark:divide-[#2C2C2E] md:hidden transition-opacity duration-150 ${isFetching && !isLoading ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse p-3 space-y-1.5">
                  <div className="h-3.5 w-3/5 rounded bg-[#F5F5F7] dark:bg-[#2C2C2E]" />
                  <div className="h-3 w-2/5 rounded bg-[#F5F5F7] dark:bg-[#2C2C2E]" />
                </div>
              ))
            ) : products.map((p) => (
              <div key={p.id} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/products/${p.id}`} className="text-sm font-semibold text-[#1D1D1F] hover:text-[#0071E3] dark:text-[#F5F5F7]">
                      {p.name}
                    </Link>
                    <p className="text-[11px] text-[#86868B]">{p.brand} · {p.category?.name ?? 'Uncategorized'}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <StockBadge status={p.stockStatus} />
                    {!p.isActive && <Badge variant="neutral" size="sm">Inactive</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-[#F5F5F7] px-3 py-2 text-xs dark:bg-[#2C2C2E]">
                  <span className="text-[#6E6E73]">WH: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{p.inventory.warehouseQuantity}</strong></span>
                  <span className="text-[#6E6E73]">Shop: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{p.inventory.shopQuantity}</strong></span>
                  <span className="text-[#6E6E73]">Total: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{p.inventory.totalQuantity}</strong></span>
                  <span className="ml-auto font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{formatCurrency(p.sellingPrice)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant={p.trackingType === 'SERIALIZED' ? 'info' : 'neutral'} size="sm">
                    {p.trackingType === 'SERIALIZED' ? 'Serialized' : 'Quantity'}
                  </Badge>
                  <ProductActionMenu
                    product={p}
                    isAdmin={isAdmin}
                    onEdit={(prod) => setEditingProduct(prod)}
                    onToggleStatus={(prod) => setStatusToggleProduct(prod)}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* pagination */}
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[#E8E8ED] bg-[#F5F5F7] px-4 py-2.5 dark:border-[#38383A] dark:bg-[#2C2C2E]">
              <span className="text-xs text-[#6E6E73]">
                Page {meta.page} of {meta.totalPages} · {meta.total} items
              </span>
              <div className="flex gap-1.5">
                <Button variant="secondary" size="sm" disabled={page <= 1 || isLoading} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                <Button variant="secondary" size="sm" disabled={page >= meta.totalPages || isLoading} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* modals */}
      <CreateProductModal isOpen={isCreateProductOpen} onClose={() => setIsCreateProductOpen(false)}
        onSuccess={() => { showSuccess('Product created.'); fetchProducts(); fetchCategories(); }} />
      <EditProductModal product={editingProduct} isOpen={!!editingProduct} onClose={() => setEditingProduct(null)}
        onSuccess={() => { showSuccess('Product updated.'); fetchProducts(); fetchCategories(); }} />
      <CreateCategoryModal isOpen={isCreateCategoryOpen} onClose={() => setIsCreateCategoryOpen(false)}
        onSuccess={(cat) => { showSuccess(`Category "${cat.name}" created.`); fetchCategories(); setCategoryId(cat.id); }} />
      <EditCategoryModal category={editingCategory} isOpen={!!editingCategory} onClose={() => setEditingCategory(null)}
        onSuccess={(cat) => { showSuccess(`Category "${cat.name}" updated.`); fetchCategories(); fetchProducts(); }} />
      <ManageCategoriesModal
        isOpen={isManageCategoriesOpen}
        onClose={() => setIsManageCategoriesOpen(false)}
        onEditCategory={(cat) => setEditingCategory(cat)}
        onCreateCategory={() => setIsCreateCategoryOpen(true)}
        onCategoriesUpdated={() => { fetchCategories(); fetchProducts(); }}
      />

      {/* deactivation confirm modal */}
      {statusToggleProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setStatusToggleProduct(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-[#D2D2D7] bg-white p-4 shadow-2xl dark:border-[#38383A] dark:bg-[#1C1C1E]">
            <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              {statusToggleProduct.isActive ? 'Deactivate Product?' : 'Activate Product?'}
            </h3>
            <p className="mt-1.5 text-xs text-[#6E6E73] leading-relaxed">
              {statusToggleProduct.isActive
                ? `Deactivating "${statusToggleProduct.name}" removes it from active inventory operations. Historical inventory and movement records will be preserved.`
                : `Activating "${statusToggleProduct.name}" restores it to active inventory workflows.`}
            </p>
            <div className="flex items-center justify-end gap-2 pt-4">
              <Button variant="secondary" size="sm" disabled={statusLoading} onClick={() => setStatusToggleProduct(null)}>
                Cancel
              </Button>
              <Button
                variant={statusToggleProduct.isActive ? 'danger' : 'primary'}
                size="sm"
                isLoading={statusLoading}
                onClick={handleConfirmStatusToggle}
              >
                {statusToggleProduct.isActive ? 'Confirm Deactivate' : 'Confirm Activate'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
