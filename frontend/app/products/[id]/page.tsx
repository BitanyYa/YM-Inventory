'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { productService } from '../../../services/product.service';
import { ProductDetail } from '../../../types/api';
import { AppShell } from '../../../components/layout/AppShell';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { EditProductModal } from '../../../components/products/EditProductModal';
import { formatCurrency } from '../../../lib/utils';
import {
  ProductsIcon,
  InventoryIcon,
  MovementsIcon,
  AlertTriangleIcon,
} from '../../../components/ui/Icons';

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.id as string;
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'PRIMARY_ADMIN';

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const fetchProductDetails = useCallback(async () => {
    if (!productId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await productService.getProduct(productId);
      setProduct(res.data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load product details.');
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchProductDetails();
  }, [fetchProductDetails]);

  const handleEditSuccess = () => {
    setSuccessBanner('Product updated successfully!');
    fetchProductDetails();
    setTimeout(() => setSuccessBanner(null), 4000);
  };

  const getStockStatusBadge = (status?: string) => {
    switch (status) {
      case 'IN_STOCK':
        return <Badge variant="success">IN STOCK</Badge>;
      case 'LOW_STOCK':
        return <Badge variant="warning">LOW STOCK</Badge>;
      case 'OUT_OF_STOCK':
        return <Badge variant="danger">OUT OF STOCK</Badge>;
      default:
        return <Badge variant="neutral">UNKNOWN</Badge>;
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Top Back Nav & Action Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/products"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 mb-2"
            >
              ← Back to Products Catalog
            </Link>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                {product?.name || 'Product Details'}
              </h2>
              {product && (
                <Badge variant={product.isActive ? 'success' : 'neutral'}>
                  {product.isActive ? 'Active' : 'Inactive'}
                </Badge>
              )}
            </div>
            {product && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Brand: <strong className="text-slate-700 dark:text-slate-300">{product.brand}</strong> • Category:{' '}
                <strong className="text-slate-700 dark:text-slate-300">
                  {product.category?.name || 'Uncategorized'}
                </strong>
              </p>
            )}
          </div>

          {isAdmin && product && (
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => setIsEditOpen(true)}
              >
                Edit Product
              </Button>
            </div>
          )}
        </div>

        {/* Success Banner */}
        {successBanner && (
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
            <span>{successBanner}</span>
            <button onClick={() => setSuccessBanner(null)} className="font-bold text-emerald-700 dark:text-emerald-300">
              ✕
            </button>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/60 dark:bg-red-950/60">
            <h3 className="text-base font-bold text-red-900 dark:text-red-200">
              Product Not Found or Error Loading
            </h3>
            <p className="mt-1 text-xs text-red-700 dark:text-red-300">{error}</p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button variant="secondary" size="sm" onClick={fetchProductDetails}>
                Retry Loading
              </Button>
              <Link href="/products">
                <Button variant="primary" size="sm">
                  Return to Products List
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
            <div className="h-64 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          </div>
        )}

        {/* Product Details Content */}
        {!isLoading && product && (
          <>
            {/* Top Cards Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Selling Price Card */}
              <Card className="border-l-4 border-l-emerald-500 p-4 sm:p-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Selling Price
                </span>
                <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                  {formatCurrency(product.sellingPrice)}
                </div>
                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                  Base unit selling price
                </span>
              </Card>

              {/* Stock Status & Threshold */}
              <Card className="border-l-4 border-l-slate-900 dark:border-l-slate-100 p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Stock Health
                  </span>
                  {getStockStatusBadge(product.stockStatus)}
                </div>
                <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                  {product.inventory?.totalQuantity || 0} Units
                </div>
                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                  Minimum threshold: <strong>{product.minimumStock}</strong> units
                </span>
              </Card>

              {/* Type & Tracking Card */}
              <Card className="border-l-4 border-l-sky-500 p-4 sm:p-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Type & Tracking
                </span>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="neutral" size="md">
                    {product.productType}
                  </Badge>
                  <Badge
                    variant={product.trackingType === 'SERIALIZED' ? 'info' : 'neutral'}
                    size="md"
                  >
                    {product.trackingType}
                  </Badge>
                </div>
                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                  {product.trackingType === 'SERIALIZED'
                    ? 'Individual IMEI/Serial tracking'
                    : 'Bulk quantity tracking'}
                </span>
              </Card>
            </div>

            {/* Inventory Breakdown & Movement Summary Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Inventory Breakdown */}
              <Card
                title={
                  <div className="flex items-center gap-2">
                    <InventoryIcon size={18} />
                    <span>Current Inventory Breakdown</span>
                  </div>
                }
                subtitle="Stock breakdown across physical locations"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                    <div>
                      <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Warehouse Stock
                      </span>
                      <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        {product.inventory?.warehouseQuantity || 0}
                      </span>
                    </div>
                    {product.unitSummary && (
                      <Badge variant="info" size="sm">
                        {product.unitSummary.warehouseAvailable} Available
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                    <div>
                      <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Shop Floor Stock
                      </span>
                      <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        {product.inventory?.shopQuantity || 0}
                      </span>
                    </div>
                    {product.unitSummary && (
                      <Badge variant="info" size="sm">
                        {product.unitSummary.shopAvailable} Available
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-slate-900 p-4 text-white dark:bg-slate-100 dark:text-slate-900">
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Total Inventory
                    </span>
                    <span className="text-xl font-extrabold">
                      {product.inventory?.totalQuantity || 0} Units
                    </span>
                  </div>
                </div>
              </Card>

              {/* Movement Summary Counts */}
              <Card
                title={
                  <div className="flex items-center gap-2">
                    <MovementsIcon size={18} />
                    <span>Stock Movement Summary</span>
                  </div>
                }
                subtitle="Historical movement counts for this product"
              >
                {product.movementSummary ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-950">
                      <span className="block text-[11px] font-semibold text-slate-500 uppercase">Stock-Ins</span>
                      <span className="text-lg font-bold text-sky-600 dark:text-sky-400">
                        {product.movementSummary.stockIn}
                      </span>
                    </div>

                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-950">
                      <span className="block text-[11px] font-semibold text-slate-500 uppercase">Transfers</span>
                      <span className="text-lg font-bold text-slate-700 dark:text-slate-300">
                        {product.movementSummary.transfers}
                      </span>
                    </div>

                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-950">
                      <span className="block text-[11px] font-semibold text-slate-500 uppercase">Sales</span>
                      <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        {product.movementSummary.sales}
                      </span>
                    </div>

                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-950">
                      <span className="block text-[11px] font-semibold text-slate-500 uppercase">Returns</span>
                      <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                        {product.movementSummary.returns}
                      </span>
                    </div>

                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-950">
                      <span className="block text-[11px] font-semibold text-slate-500 uppercase">Damages</span>
                      <span className="text-lg font-bold text-red-600 dark:text-red-400">
                        {product.movementSummary.damages}
                      </span>
                    </div>

                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-950">
                      <span className="block text-[11px] font-semibold text-slate-500 uppercase">Losses</span>
                      <span className="text-lg font-bold text-red-600 dark:text-red-400">
                        {product.movementSummary.losses}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No movement summary available.</p>
                )}
              </Card>
            </div>

            {/* Serialized Units Table Section */}
            {product.trackingType === 'SERIALIZED' && (
              <Card
                title={`Serialized Product Units (${product.units?.length || 0})`}
                subtitle="All tracked individual units for this product"
              >
                {!product.units || product.units.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No serialized units recorded for this product yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50 font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                        <tr>
                          <th className="px-4 py-3">IMEI</th>
                          <th className="px-4 py-3">Serial Number</th>
                          <th className="px-4 py-3">Storage / Color</th>
                          <th className="px-4 py-3">Location</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Purchase Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {product.units.map((unit) => (
                          <tr key={unit.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                            <td className="px-4 py-3 font-mono font-semibold text-slate-900 dark:text-slate-100">
                              {unit.imei || '—'}
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">
                              {unit.serialNumber || '—'}
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                              {unit.storage || '—'} {unit.color ? `/ ${unit.color}` : ''}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                              {unit.location}
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                variant={
                                  unit.status === 'AVAILABLE' || unit.status === 'IN_SHOP'
                                    ? 'success'
                                    : unit.status === 'SOLD'
                                      ? 'neutral'
                                      : 'danger'
                                }
                                size="sm"
                              >
                                {unit.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">
                              {unit.purchasePrice ? formatCurrency(unit.purchasePrice) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}

            {/* Description Card if present */}
            {product.description && (
              <Card title="Product Description">
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {product.description}
                </p>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Edit Product Modal */}
      {product && (
        <EditProductModal
          product={product}
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          onSuccess={handleEditSuccess}
        />
      )}
    </AppShell>
  );
}
