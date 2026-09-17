'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Branch,
  BranchInventoryItem,
  BranchTransferItem,
  ProductItem,
  PaginationMeta,
  ReverseBranchTransferResponse,
} from '../../types/api';
import { branchTransfersService } from '../../services/branch-transfers.service';
import { productService } from '../../services/product.service';
import { useAuth } from '../../context/AuthContext';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { TransferToBranchModal } from '../../components/branch-transfers/TransferToBranchModal';
import { ReverseBranchTransferModal } from '../../components/branch-transfers/ReverseBranchTransferModal';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
  FilterIcon,
  PlusIcon,
  RefreshCwIcon,
  RotateCcwIcon,
} from '../../components/ui/Icons';
import { formatDate } from '../../lib/utils';

export default function BranchTransfersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  // Modal States
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedTransferForReversal, setSelectedTransferForReversal] = useState<BranchTransferItem | null>(null);

  // Success Toast Notification
  const [successNotification, setSuccessNotification] = useState<string | null>(null);

  // Filter States
  const [branchesList, setBranchesList] = useState<Branch[]>([]);
  const [productsList, setProductsList] = useState<ProductItem[]>([]);
  const [filterBranchId, setFilterBranchId] = useState<string>('');
  const [filterProductId, setFilterProductId] = useState<string>('');

  // Current Stock Balances State
  const [branchStock, setBranchStock] = useState<BranchInventoryItem[]>([]);
  const [isLoadingStock, setIsLoadingStock] = useState<boolean>(true);
  const [stockError, setStockError] = useState<string | null>(null);

  // Transfer History State
  const [transfers, setTransfers] = useState<BranchTransferItem[]>([]);
  const [transfersMeta, setTransfersMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Expanded Reversal Logs per transfer ID
  const [expandedReversals, setExpandedReversals] = useState<Record<string, boolean>>({});

  // Auto-dismiss success notification
  useEffect(() => {
    if (successNotification) {
      const timer = setTimeout(() => {
        setSuccessNotification(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [successNotification]);

  // Load Filter Options (Branches & Products)
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [branchesData, productsRes] = await Promise.all([
          branchTransfersService.getBranches(),
          productService.getProducts({ limit: 100 }),
        ]);
        setBranchesList(branchesData || []);
        setProductsList(productsRes.data || []);
      } catch (err) {
        console.error('Failed to load branch transfer filter options:', err);
      }
    };
    loadFilterOptions();
  }, []);

  // Fetch Current Branch Stock
  const fetchBranchStock = useCallback(async () => {
    setIsLoadingStock(true);
    setStockError(null);
    try {
      const data = await branchTransfersService.getBranchInventory({
        branchId: filterBranchId || undefined,
        productId: filterProductId || undefined,
      });
      setBranchStock(data || []);
    } catch (err: unknown) {
      setStockError((err as { message?: string })?.message || 'Failed to load branch stock balances.');
    } finally {
      setIsLoadingStock(false);
    }
  }, [filterBranchId, filterProductId]);

  // Fetch Branch Transfer History
  const fetchTransferHistory = useCallback(async (pageToFetch: number) => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const res = await branchTransfersService.getBranchTransfers({
        page: pageToFetch,
        limit: 10,
        branchId: filterBranchId || undefined,
        productId: filterProductId || undefined,
      });
      setTransfers(res.data || []);
      setTransfersMeta({
        page: res.page,
        limit: res.limit,
        total: res.total,
        totalPages: res.totalPages,
      });
    } catch (err: unknown) {
      setHistoryError((err as { message?: string })?.message || 'Failed to load branch transfer history.');
    } finally {
      setIsLoadingHistory(false);
    }
  }, [filterBranchId, filterProductId]);

  // Initial & Filter-triggered loading
  useEffect(() => {
    fetchBranchStock();
  }, [fetchBranchStock]);

  useEffect(() => {
    fetchTransferHistory(currentPage);
  }, [fetchTransferHistory, currentPage]);

  const handleResetFilters = () => {
    setFilterBranchId('');
    setFilterProductId('');
    setCurrentPage(1);
  };

  const handleSuccessTransfer = () => {
    setSuccessNotification('Stock transferred to branch successfully.');
    fetchBranchStock();
    fetchTransferHistory(1);
    setCurrentPage(1);
  };

  const handleSuccessReversal = (res?: ReverseBranchTransferResponse) => {
    if (res) {
      setSuccessNotification(
        `Successfully reversed ${res.reversedQuantity} unit(s) of ${res.product.name} from branch ${res.branch.name}. Stock returned to Main Shop.`,
      );
    } else {
      setSuccessNotification('Branch transfer history updated.');
    }
    fetchBranchStock();
    fetchTransferHistory(currentPage);
  };

  const toggleExpandReversals = (transferId: string) => {
    setExpandedReversals((prev) => ({
      ...prev,
      [transferId]: !prev[transferId],
    }));
  };

  const hasActiveFilters = !!filterBranchId || !!filterProductId;

  return (
    <AppShell>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Toast / Banner Notification */}
        {successNotification && (
          <div className="flex items-center justify-between rounded-xl border border-[#34C759]/30 bg-[#EAF9EC] p-4 text-xs font-medium text-[#1E7E34] shadow-sm dark:border-[#30D158]/30 dark:bg-[#0A2E12] dark:text-[#30D158]">
            <div className="flex items-center gap-2.5">
              <CheckCircleIcon size={18} className="shrink-0" />
              <span>{successNotification}</span>
            </div>
            <button
              onClick={() => setSuccessNotification(null)}
              className="rounded-lg p-1 text-[#1E7E34] hover:bg-[#34C759]/10 dark:text-[#30D158]"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#E8E8ED] pb-4 dark:border-[#2C2C2E]">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
              Branch Stock Transfers
            </h1>
            <p className="mt-1 text-xs text-[#6E6E73] dark:text-[#86868B]">
              Track and manage inventory stock transferred from Main Shop to physical branches.
            </p>
          </div>

          {isAdmin && (
            <div>
              <Button
                variant="primary"
                size="md"
                onClick={() => setIsTransferModalOpen(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5"
              >
                <PlusIcon size={16} />
                <span>Transfer Stock to Branch</span>
              </Button>
            </div>
          )}
        </div>

        {/* Filter Toolbar */}
        <div className="rounded-2xl border border-[#E8E8ED] bg-white p-4 shadow-xs dark:border-[#2C2C2E] dark:bg-[#1C1C1E] space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
            <FilterIcon size={14} className="text-[#0071E3]" />
            <span>Filter Branch Transfers</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 items-end">
            {/* Branch Filter */}
            <Select
              label="Branch"
              value={filterBranchId}
              onChange={(val) => {
                setFilterBranchId(val);
                setCurrentPage(1);
              }}
              options={[
                { value: '', label: 'All Branches' },
                ...branchesList.map((b) => ({
                  value: b.id,
                  label: b.name,
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

        {/* Section 1: Current Branch Stock */}
        <div className="rounded-2xl border border-[#E8E8ED] bg-white shadow-xs dark:border-[#2C2C2E] dark:bg-[#1C1C1E] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E8E8ED] px-5 py-4 dark:border-[#2C2C2E]">
            <div>
              <h2 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Current Branch Stock
              </h2>
              <p className="mt-0.5 text-[11px] text-[#6E6E73] dark:text-[#86868B]">
                Active inventory quantity currently held at each branch.
              </p>
            </div>
            <button
              onClick={() => fetchBranchStock()}
              className="rounded-lg p-1.5 text-[#86868B] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] dark:hover:bg-[#2C2C2E]"
              title="Refresh branch stock"
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
          ) : branchStock.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#86868B]">
              No stock has been transferred to branches yet.
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E8E8ED] bg-[#F5F5F7] font-semibold text-[#6E6E73] dark:border-[#2C2C2E] dark:bg-[#2C2C2E]/50 dark:text-[#86868B]">
                    <tr>
                      <th className="px-5 py-3">Branch</th>
                      <th className="px-5 py-3">Product</th>
                      <th className="px-5 py-3">Type</th>
                      <th className="px-5 py-3 text-right">Branch Stock Qty</th>
                      <th className="px-5 py-3 text-right">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E8ED] text-[#1D1D1F] dark:divide-[#2C2C2E] dark:text-[#F5F5F7]">
                    {branchStock.map((item) => (
                      <tr
                        key={item.id}
                        className="transition-colors hover:bg-[#F5F5F7]/60 dark:hover:bg-[#2C2C2E]/40"
                      >
                        <td className="px-5 py-3.5 font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                          <Badge variant="info" size="sm">
                            {item.branch.name}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="block font-medium">{item.product.name}</span>
                          <span className="block text-[11px] text-[#86868B]">{item.product.brand}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge variant="neutral" size="sm">
                            {item.product.productType}
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
                {branchStock.map((item) => (
                  <div key={item.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <Badge variant="info" size="sm">
                        {item.branch.name}
                      </Badge>
                      <span className="font-bold text-xs text-[#0071E3] dark:text-[#2997FF]">
                        Qty: {item.quantity}
                      </span>
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

        {/* Section 2: Branch Transfer History */}
        <div className="rounded-2xl border border-[#E8E8ED] bg-white shadow-xs dark:border-[#2C2C2E] dark:bg-[#1C1C1E] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E8E8ED] px-5 py-4 dark:border-[#2C2C2E]">
            <div>
              <h2 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Branch Transfer History
              </h2>
              <p className="mt-0.5 text-[11px] text-[#6E6E73] dark:text-[#86868B]">
                Historical log of Main Shop → Branch stock transfers with real-time reversal tracking.
              </p>
            </div>
            <button
              onClick={() => fetchTransferHistory(currentPage)}
              className="rounded-lg p-1.5 text-[#86868B] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] dark:hover:bg-[#2C2C2E]"
              title="Refresh transfer history"
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
          ) : transfers.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#86868B]">
              No branch transfer history yet.
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E8E8ED] bg-[#F5F5F7] font-semibold text-[#6E6E73] dark:border-[#2C2C2E] dark:bg-[#2C2C2E]/50 dark:text-[#86868B]">
                    <tr>
                      <th className="px-5 py-3">Date / Time</th>
                      <th className="px-5 py-3">Destination Branch</th>
                      <th className="px-5 py-3">Product</th>
                      <th className="px-5 py-3 text-right">Quantities</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Transferred By</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E8ED] text-[#1D1D1F] dark:divide-[#2C2C2E] dark:text-[#F5F5F7]">
                    {transfers.map((t) => {
                      const origQty = t.quantity;
                      const reversedQty = t.reversedQuantity ?? 0;
                      const remainingQty = t.remainingQuantity ?? (origQty - reversedQty);
                      const isFullyReversed = remainingQty === 0;
                      const hasReversals = reversedQty > 0 || (t.reversals && t.reversals.length > 0);
                      const isExpanded = !!expandedReversals[t.id];

                      return (
                        <React.Fragment key={t.id}>
                          <tr className="transition-colors hover:bg-[#F5F5F7]/60 dark:hover:bg-[#2C2C2E]/40">
                            <td className="px-5 py-3.5 text-[11px] text-[#86868B] whitespace-nowrap">
                              {formatDate(t.createdAt)}
                            </td>
                            <td className="px-5 py-3.5 font-medium">
                              <Badge variant="info" size="sm">
                                {t.branch.name}
                              </Badge>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="font-medium">{t.product.name}</span>
                              <span className="text-[#86868B] ml-1">({t.product.brand})</span>
                            </td>
                            <td className="px-5 py-3.5 text-right font-medium">
                              <div className="text-[11px]">
                                <span className="text-[#6E6E73] dark:text-[#86868B]">Transferred: </span>
                                <span className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">{origQty}</span>
                              </div>
                              {reversedQty > 0 && (
                                <div className="text-[11px] text-[#9E6200] dark:text-[#FF9F0A]">
                                  <span>Reversed: </span>
                                  <span className="font-bold">{reversedQty}</span>
                                </div>
                              )}
                              <div className="text-[11px]">
                                <span className="text-[#6E6E73] dark:text-[#86868B]">Remaining: </span>
                                <span
                                  className={`font-bold ${
                                    isFullyReversed
                                      ? 'text-[#86868B] line-through'
                                      : 'text-[#0071E3] dark:text-[#2997FF]'
                                  }`}
                                >
                                  {remainingQty}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              {isFullyReversed ? (
                                <Badge variant="neutral" size="sm">
                                  Fully Reversed
                                </Badge>
                              ) : reversedQty > 0 ? (
                                <Badge variant="warning" size="sm">
                                  Partially Reversed
                                </Badge>
                              ) : (
                                <Badge variant="success" size="sm">
                                  Active
                                </Badge>
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="text-[11px] text-[#6E6E73] dark:text-[#86868B]">
                                {t.transferredBy.name}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {isAdmin && remainingQty > 0 ? (
                                  <button
                                    onClick={() => setSelectedTransferForReversal(t)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-[#FF9F0A]/40 bg-[#FFF9F0] px-2.5 py-1.5 text-xs font-semibold text-[#9E6200] transition-colors hover:bg-[#FF9F0A]/20 dark:border-[#FF9F0A]/30 dark:bg-[#2E1F0A] dark:text-[#FF9F0A] dark:hover:bg-[#FF9F0A]/30"
                                    title="Reverse transferred stock back to Main Shop"
                                  >
                                    <RotateCcwIcon size={13} />
                                    <span>Reverse Transfer</span>
                                  </button>
                                ) : isFullyReversed ? (
                                  <span className="text-[11px] italic text-[#86868B]">
                                    Fully Reversed
                                  </span>
                                ) : null}

                                {hasReversals && (
                                  <button
                                    onClick={() => toggleExpandReversals(t.id)}
                                    className="rounded-lg p-1.5 text-[#86868B] hover:bg-[#E8E8ED] hover:text-[#1D1D1F] dark:hover:bg-[#2C2C2E] dark:hover:text-[#F5F5F7]"
                                    title={isExpanded ? 'Hide reversal log' : 'View reversal log'}
                                  >
                                    {isExpanded ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Reversal Log Sub-row */}
                          {isExpanded && t.reversals && t.reversals.length > 0 && (
                            <tr className="bg-[#FFF9F0]/60 dark:bg-[#2E1F0A]/30">
                              <td colSpan={7} className="px-5 py-3">
                                <div className="rounded-xl border border-[#FF9F0A]/20 bg-white/80 p-3 shadow-inner dark:border-[#FF9F0A]/20 dark:bg-[#1C1C1E]/80">
                                  <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-[#9E6200] dark:text-[#FF9F0A]">
                                    <RotateCcwIcon size={13} />
                                    <span>Reversal Log ({t.reversals.length})</span>
                                  </div>
                                  <div className="space-y-2 divide-y divide-[#E8E8ED] dark:divide-[#2C2C2E]">
                                    {t.reversals.map((rev) => (
                                      <div
                                        key={rev.id}
                                        className="pt-2 first:pt-0 flex flex-col sm:flex-row sm:items-center sm:justify-between text-[11px] gap-1"
                                      >
                                        <div className="flex items-center gap-2">
                                          <Badge variant="warning" size="sm">
                                            -{rev.quantity} units
                                          </Badge>
                                          <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                                            Reason: &quot;{rev.reason}&quot;
                                          </span>
                                        </div>
                                        <div className="text-[#86868B] flex items-center gap-2 shrink-0">
                                          <span>Reversed by: {rev.reversedBy?.name || 'Admin'}</span>
                                          <span>•</span>
                                          <span>{formatDate(rev.createdAt)}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List */}
              <div className="block md:hidden divide-y divide-[#E8E8ED] dark:divide-[#2C2C2E]">
                {transfers.map((t) => {
                  const origQty = t.quantity;
                  const reversedQty = t.reversedQuantity ?? 0;
                  const remainingQty = t.remainingQuantity ?? (origQty - reversedQty);
                  const isFullyReversed = remainingQty === 0;
                  const hasReversals = reversedQty > 0 || (t.reversals && t.reversals.length > 0);
                  const isExpanded = !!expandedReversals[t.id];

                  return (
                    <div key={t.id} className="p-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#86868B]">
                          {formatDate(t.createdAt)}
                        </span>
                        {isFullyReversed ? (
                          <Badge variant="neutral" size="sm">
                            Fully Reversed
                          </Badge>
                        ) : reversedQty > 0 ? (
                          <Badge variant="warning" size="sm">
                            Partially Reversed
                          </Badge>
                        ) : (
                          <Badge variant="success" size="sm">
                            Active
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                          Branch: {t.branch.name}
                        </span>
                        <span className="text-[11px] text-[#86868B]">By: {t.transferredBy.name}</span>
                      </div>

                      <div className="text-[11px] text-[#6E6E73] dark:text-[#86868B]">
                        {t.product.name} ({t.product.brand})
                      </div>

                      <div className="rounded-lg bg-[#F5F5F7] p-2 dark:bg-[#2C2C2E] grid grid-cols-3 gap-1 text-center text-[11px]">
                        <div>
                          <span className="block text-[9px] text-[#86868B]">Transferred</span>
                          <span className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                            {origQty}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[9px] text-[#86868B]">Reversed</span>
                          <span className="font-bold text-[#9E6200] dark:text-[#FF9F0A]">
                            {reversedQty}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[9px] text-[#86868B]">Remaining</span>
                          <span
                            className={`font-bold ${
                              isFullyReversed ? 'text-[#86868B] line-through' : 'text-[#0071E3]'
                            }`}
                          >
                            {remainingQty}
                          </span>
                        </div>
                      </div>

                      {t.note && (
                        <div className="text-[10px] italic text-[#86868B]">
                          Note: {t.note}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        {hasReversals ? (
                          <button
                            onClick={() => toggleExpandReversals(t.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0071E3] hover:underline dark:text-[#2997FF]"
                          >
                            <span>{isExpanded ? 'Hide reversals' : 'View reversals'}</span>
                            {isExpanded ? <ChevronUpIcon size={12} /> : <ChevronDownIcon size={12} />}
                          </button>
                        ) : <span />}

                        {isAdmin && remainingQty > 0 && (
                          <button
                            onClick={() => setSelectedTransferForReversal(t)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#FF9F0A]/40 bg-[#FFF9F0] px-2.5 py-1 text-xs font-semibold text-[#9E6200] dark:border-[#FF9F0A]/30 dark:bg-[#2E1F0A] dark:text-[#FF9F0A]"
                          >
                            <RotateCcwIcon size={12} />
                            <span>Reverse Transfer</span>
                          </button>
                        )}
                      </div>

                      {/* Mobile Expanded Reversals */}
                      {isExpanded && t.reversals && t.reversals.length > 0 && (
                        <div className="mt-2 rounded-lg border border-[#FF9F0A]/20 bg-[#FFF9F0] p-2.5 space-y-1.5 dark:bg-[#2E1F0A]">
                          <div className="text-[10px] font-bold text-[#9E6200] dark:text-[#FF9F0A]">
                            Reversal Log:
                          </div>
                          {t.reversals.map((rev) => (
                            <div key={rev.id} className="text-[10px] space-y-0.5 border-t border-[#FF9F0A]/20 pt-1">
                              <div className="flex justify-between font-semibold">
                                <span>Reversed Qty: {rev.quantity}</span>
                                <span>{formatDate(rev.createdAt)}</span>
                              </div>
                              <div>Reason: {rev.reason}</div>
                              <div className="text-[#86868B]">By: {rev.reversedBy?.name}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pagination Footer */}
              {transfersMeta.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-[#E8E8ED] px-5 py-3 text-xs dark:border-[#2C2C2E]">
                  <span className="text-[#86868B]">
                    Page {transfersMeta.page} of {transfersMeta.totalPages} ({transfersMeta.total} total)
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
                      disabled={currentPage >= transfersMeta.totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, transfersMeta.totalPages))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Transfer Action Modal */}
        <TransferToBranchModal
          isOpen={isTransferModalOpen}
          onClose={() => setIsTransferModalOpen(false)}
          onSuccess={handleSuccessTransfer}
        />

        {/* Reverse Branch Transfer Modal */}
        <ReverseBranchTransferModal
          isOpen={!!selectedTransferForReversal}
          transfer={selectedTransferForReversal}
          onClose={() => setSelectedTransferForReversal(null)}
          onSuccess={handleSuccessReversal}
        />
      </div>
    </AppShell>
  );
}
