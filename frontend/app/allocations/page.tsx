'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ProductAllocationItem, SalespersonStockItem, Salesperson, ProductItem, PaginationMeta } from '../../types/api';
import { salespersonStockService } from '../../services/salesperson-stock.service';
import { salespeopleService } from '../../services/salespeople.service';
import { productService } from '../../services/product.service';
import { useAuth } from '../../context/AuthContext';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { AllocateProductModal } from '../../components/allocations/AllocateProductModal';
import { AlertTriangleIcon, FilterIcon, RefreshCwIcon, PlusIcon } from '../../components/ui/Icons';
import { formatDate } from '../../lib/utils';

export default function AllocationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  // Modal State
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);

  // Filter States
  const [salespeopleList, setSalespeopleList] = useState<Salesperson[]>([]);
  const [productsList, setProductsList] = useState<ProductItem[]>([]);
  const [filterSalespersonId, setFilterSalespersonId] = useState<string>('');
  const [filterProductId, setFilterProductId] = useState<string>('');

  // Current Stock Balances State
  const [stockBalances, setStockBalances] = useState<SalespersonStockItem[]>([]);
  const [isLoadingStock, setIsLoadingStock] = useState<boolean>(true);
  const [stockError, setStockError] = useState<string | null>(null);

  // Allocation History State
  const [allocations, setAllocations] = useState<ProductAllocationItem[]>([]);
  const [allocationsMeta, setAllocationsMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Load Filter Options (Salespeople & Products)
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [salespeopleData, productsRes] = await Promise.all([
          salespeopleService.getSalespeople(),
          productService.getProducts({ limit: 100 }),
        ]);
        setSalespeopleList(salespeopleData || []);
        setProductsList(productsRes.data || []);
      } catch (err) {
        console.error('Failed to load allocation filter options:', err);
      }
    };
    loadFilterOptions();
  }, []);

  // Fetch Stock Balances
  const fetchStockBalances = useCallback(async () => {
    setIsLoadingStock(true);
    setStockError(null);
    try {
      const data = await salespersonStockService.getSalespersonStock({
        salespersonId: filterSalespersonId || undefined,
        productId: filterProductId || undefined,
      });
      setStockBalances(data || []);
    } catch (err: unknown) {
      setStockError((err as { message?: string })?.message || 'Failed to load salesperson stock balances.');
    } finally {
      setIsLoadingStock(false);
    }
  }, [filterSalespersonId, filterProductId]);

  // Fetch Allocation History
  const fetchAllocationHistory = useCallback(async (pageToFetch: number) => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const res = await salespersonStockService.getAllocations({
        page: pageToFetch,
        limit: 10,
        salespersonId: filterSalespersonId || undefined,
        productId: filterProductId || undefined,
      });
      setAllocations(res.data || []);
      setAllocationsMeta(res.meta);
    } catch (err: unknown) {
      setHistoryError((err as { message?: string })?.message || 'Failed to load allocation history.');
    } finally {
      setIsLoadingHistory(false);
    }
  }, [filterSalespersonId, filterProductId]);

  // Initial and Filter-triggered data loading
  useEffect(() => {
    fetchStockBalances();
  }, [fetchStockBalances]);

  useEffect(() => {
    fetchAllocationHistory(currentPage);
  }, [fetchAllocationHistory, currentPage]);

  const handleResetFilters = () => {
    setFilterSalespersonId('');
    setFilterProductId('');
    setCurrentPage(1);
  };

  const handleSuccessAllocation = () => {
    fetchStockBalances();
    fetchAllocationHistory(1);
    setCurrentPage(1);
  };

  const hasActiveFilters = !!filterSalespersonId || !!filterProductId;

  return (
    <AppShell>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#E8E8ED] pb-4 dark:border-[#2C2C2E]">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
              Product Allocation
            </h1>
            <p className="mt-1 text-xs text-[#6E6E73] dark:text-[#86868B]">
              Track products allocated to individual salespeople.
            </p>
          </div>

          {isAdmin && (
            <div>
              <Button
                variant="primary"
                size="md"
                onClick={() => setIsAllocateModalOpen(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5"
              >
                <PlusIcon size={16} />
                <span>Allocate Product</span>
              </Button>
            </div>
          )}
        </div>

        {/* Filter Toolbar */}
        <div className="rounded-2xl border border-[#E8E8ED] bg-white p-4 shadow-xs dark:border-[#2C2C2E] dark:bg-[#1C1C1E] space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
            <FilterIcon size={14} className="text-[#0071E3]" />
            <span>Filter Allocations</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 items-end">
            {/* Salesperson Filter */}
            <Select
              label="Salesperson"
              value={filterSalespersonId}
              onChange={(val) => {
                setFilterSalespersonId(val);
                setCurrentPage(1);
              }}
              disabled={salespeopleList.length === 0}
              options={[
                {
                  value: '',
                  label: salespeopleList.length === 0 ? 'No salespeople available' : 'All Salespeople',
                },
                ...salespeopleList.map((sp) => ({
                  value: sp.id,
                  label: sp.phone ? `${sp.name} (${sp.phone})` : sp.name,
                })),
              ]}
            />

            {/* Product Filter */}
            <Select
              label="Product"
              value={filterProductId}
              onChange={(val) => {
                setFilterProductId(val);
                setCurrentPage(1);
              }}
              options={[
                { value: '', label: 'All Products' },
                ...productsList.map((p) => ({
                  value: p.id,
                  label: `${p.name} (${p.brand})`,
                })),
              ]}
            />

            {/* Reset Filters */}
            {hasActiveFilters && (
              <div className="pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleResetFilters}
                  className="w-full sm:w-auto"
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Section 1: Current Salesperson Stock Balances */}
        <div className="rounded-2xl border border-[#E8E8ED] bg-white shadow-xs dark:border-[#2C2C2E] dark:bg-[#1C1C1E] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E8E8ED] px-5 py-4 dark:border-[#2C2C2E]">
            <div>
              <h2 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Current Salesperson Stock Balances
              </h2>
              <p className="mt-0.5 text-[11px] text-[#6E6E73] dark:text-[#86868B]">
                Active inventory quantity held per salesperson.
              </p>
            </div>
            <button
              onClick={() => fetchStockBalances()}
              className="rounded-lg p-1.5 text-[#86868B] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] dark:hover:bg-[#2C2C2E]"
              title="Refresh stock balances"
            >
              <RefreshCwIcon size={14} />
            </button>
          </div>

          {stockError && (
            <div className="m-4 flex items-center gap-2 rounded-xl border border-[#FF3B30]/20 bg-[#FFECEB] p-3 text-xs text-[#CC2B22] dark:border-[#FF453A]/20 dark:bg-[#2E0A09] dark:text-[#FF453A]">
              <AlertTriangleIcon size={14} className="shrink-0" />
              <span>{stockError}</span>
            </div>
          )}

          {isLoadingStock ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="md" className="text-[#0071E3]" />
            </div>
          ) : stockBalances.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#86868B]">
              No salesperson stock allocated yet.
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E8E8ED] bg-[#F5F5F7] font-semibold text-[#6E6E73] dark:border-[#2C2C2E] dark:bg-[#2C2C2E]/50 dark:text-[#86868B]">
                    <tr>
                      <th className="px-5 py-3">Salesperson</th>
                      <th className="px-5 py-3">Product</th>
                      <th className="px-5 py-3">Category</th>
                      <th className="px-5 py-3 text-right">Allocated Qty</th>
                      <th className="px-5 py-3 text-right">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E8ED] text-[#1D1D1F] dark:divide-[#2C2C2E] dark:text-[#F5F5F7]">
                    {stockBalances.map((item) => (
                      <tr
                        key={item.id}
                        className="transition-colors hover:bg-[#F5F5F7]/60 dark:hover:bg-[#2C2C2E]/40"
                      >
                        <td className="px-5 py-3.5 font-medium">
                          <span className="block font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                            {item.salesperson.name}
                          </span>
                          {item.salesperson.phone && (
                            <span className="block text-[11px] text-[#86868B]">
                              {item.salesperson.phone}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="block font-medium">{item.product.name}</span>
                          <span className="block text-[11px] text-[#86868B]">{item.product.brand}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge variant="neutral" size="sm">
                            {item.product.category?.name ?? 'General'}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-[#0071E3] dark:text-[#2997FF]">
                          {item.quantity}
                        </td>
                        <td className="px-5 py-3.5 text-right text-[11px] text-[#86868B]">
                          {formatDate(item.updatedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List */}
              <div className="block md:hidden divide-y divide-[#E8E8ED] dark:divide-[#2C2C2E]">
                {stockBalances.map((item) => (
                  <div key={item.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="block font-bold text-xs text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {item.salesperson.name}
                        </span>
                        {item.salesperson.phone && (
                          <span className="block text-[10px] text-[#86868B]">{item.salesperson.phone}</span>
                        )}
                      </div>
                      <Badge variant="info" size="sm">
                        Qty: {item.quantity}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <div>
                        <span className="font-semibold">{item.product.name}</span>
                        <span className="text-[#86868B] ml-1">({item.product.brand})</span>
                      </div>
                      <span className="text-[10px] text-[#86868B]">
                        {formatDate(item.updatedAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Section 2: Product Allocation History */}
        <div className="rounded-2xl border border-[#E8E8ED] bg-white shadow-xs dark:border-[#2C2C2E] dark:bg-[#1C1C1E] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E8E8ED] px-5 py-4 dark:border-[#2C2C2E]">
            <div>
              <h2 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Product Allocation History
              </h2>
              <p className="mt-0.5 text-[11px] text-[#6E6E73] dark:text-[#86868B]">
                Immutable historical log of individual product allocation events.
              </p>
            </div>
            <button
              onClick={() => fetchAllocationHistory(currentPage)}
              className="rounded-lg p-1.5 text-[#86868B] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] dark:hover:bg-[#2C2C2E]"
              title="Refresh allocation history"
            >
              <RefreshCwIcon size={14} />
            </button>
          </div>

          {historyError && (
            <div className="m-4 flex items-center gap-2 rounded-xl border border-[#FF3B30]/20 bg-[#FFECEB] p-3 text-xs text-[#CC2B22] dark:border-[#FF453A]/20 dark:bg-[#2E0A09] dark:text-[#FF453A]">
              <AlertTriangleIcon size={14} className="shrink-0" />
              <span>{historyError}</span>
            </div>
          )}

          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="md" className="text-[#0071E3]" />
            </div>
          ) : allocations.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#86868B]">
              No allocation history yet.
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E8E8ED] bg-[#F5F5F7] font-semibold text-[#6E6E73] dark:border-[#2C2C2E] dark:bg-[#2C2C2E]/50 dark:text-[#86868B]">
                    <tr>
                      <th className="px-5 py-3">Date / Time</th>
                      <th className="px-5 py-3">Salesperson</th>
                      <th className="px-5 py-3">Product</th>
                      <th className="px-5 py-3 text-right">Quantity</th>
                      <th className="px-5 py-3">Allocated By</th>
                      <th className="px-5 py-3">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E8ED] text-[#1D1D1F] dark:divide-[#2C2C2E] dark:text-[#F5F5F7]">
                    {allocations.map((a) => (
                      <tr
                        key={a.id}
                        className="transition-colors hover:bg-[#F5F5F7]/60 dark:hover:bg-[#2C2C2E]/40"
                      >
                        <td className="px-5 py-3.5 text-[11px] text-[#86868B] whitespace-nowrap">
                          {formatDate(a.createdAt)}
                        </td>
                        <td className="px-5 py-3.5 font-medium">
                          {a.salesperson.name}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-medium">{a.product.name}</span>
                          <span className="text-[#86868B] ml-1">({a.product.brand})</span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-[#0071E3] dark:text-[#2997FF]">
                          {a.quantity}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge variant="neutral" size="sm">
                            {a.allocatedBy.name}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-[11px] text-[#86868B] max-w-xs truncate">
                          {a.note || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List */}
              <div className="block md:hidden divide-y divide-[#E8E8ED] dark:divide-[#2C2C2E]">
                {allocations.map((a) => (
                  <div key={a.id} className="p-4 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[#86868B]">{formatDate(a.createdAt)}</span>
                      <Badge variant="info" size="sm">
                        Qty: {a.quantity}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {a.salesperson.name}
                      </span>
                      <span className="text-[11px] text-[#86868B]">By: {a.allocatedBy.name}</span>
                    </div>

                    <div className="text-[11px] text-[#6E6E73] dark:text-[#86868B]">
                      {a.product.name} ({a.product.brand})
                    </div>

                    {a.note && (
                      <div className="text-[10px] italic text-[#86868B] pt-0.5">
                        Note: {a.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination Footer */}
              {allocationsMeta.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-[#E8E8ED] px-5 py-3 text-xs dark:border-[#2C2C2E]">
                  <span className="text-[#86868B]">
                    Page {allocationsMeta.page} of {allocationsMeta.totalPages} ({allocationsMeta.total} total)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={currentPage >= allocationsMeta.totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, allocationsMeta.totalPages))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Allocation Action Modal */}
        <AllocateProductModal
          isOpen={isAllocateModalOpen}
          onClose={() => setIsAllocateModalOpen(false)}
          onSuccess={handleSuccessAllocation}
        />
      </div>
    </AppShell>
  );
}
