'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Salesperson } from '../../types/api';
import { salespeopleService } from '../../services/salespeople.service';
import { useAuth } from '../../context/AuthContext';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { CreateSalespersonModal } from '../../components/salespeople/CreateSalespersonModal';
import { EditSalespersonModal } from '../../components/salespeople/EditSalespersonModal';
import {
  AlertTriangleIcon,
  EditIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  UsersIcon,
} from '../../components/ui/Icons';
import { formatDate } from '../../lib/utils';

export default function SalespeoplePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  // Data State
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter / Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSalesperson, setEditingSalesperson] = useState<Salesperson | null>(null);

  // Fetch Salespeople
  const fetchSalespeople = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await salespeopleService.getSalespeople({
        search: searchQuery.trim() || undefined,
        includeInactive,
      });
      setSalespeople(data || []);
    } catch (err: unknown) {
      setError(
        (err as { message?: string })?.message ||
          'Failed to load salespeople list.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, includeInactive]);

  useEffect(() => {
    fetchSalespeople();
  }, [fetchSalespeople]);

  return (
    <AppShell>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#E8E8ED] pb-4 dark:border-[#2C2C2E]">
          <div>
            <div className="flex items-center gap-2">
              <UsersIcon className="h-6 w-6 text-[#0071E3]" />
              <h1 className="text-xl font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                Salespeople
              </h1>
            </div>
            <p className="mt-1 text-xs text-[#6E6E73] dark:text-[#86868B]">
              People who receive allocated stock from the Main Shop. Salespeople operate independently and do not require YM Inventory login accounts.
            </p>
          </div>

          {isAdmin && (
            <div>
              <Button
                variant="primary"
                size="md"
                onClick={() => setIsCreateModalOpen(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5"
              >
                <PlusIcon size={16} />
                <span>Add Salesperson</span>
              </Button>
            </div>
          )}
        </div>

        {/* Search & Filter Toolbar */}
        <div className="rounded-2xl border border-[#E8E8ED] bg-white p-4 shadow-xs dark:border-[#2C2C2E] dark:bg-[#1C1C1E] space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#86868B]">
                <SearchIcon size={16} />
              </div>
              <Input
                type="text"
                placeholder="Search salesperson by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Inactive Toggle */}
            <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0">
              <label
                htmlFor="toggle-inactive-salespeople"
                className="flex items-center gap-2 text-xs text-[#1D1D1F] dark:text-[#F5F5F7] cursor-pointer select-none"
              >
                <input
                  id="toggle-inactive-salespeople"
                  type="checkbox"
                  checked={includeInactive}
                  onChange={(e) => setIncludeInactive(e.target.checked)}
                  className="h-4 w-4 rounded border-[#D2D2D7] text-[#0071E3] focus:ring-[#0071E3] cursor-pointer"
                />
                <span>Show inactive salespeople</span>
              </label>

              <button
                onClick={() => fetchSalespeople()}
                className="rounded-lg p-1.5 text-[#86868B] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] dark:hover:bg-[#2C2C2E]"
                title="Refresh list"
              >
                <RefreshCwIcon size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Table / List */}
        <div className="rounded-2xl border border-[#E8E8ED] bg-white shadow-xs dark:border-[#2C2C2E] dark:bg-[#1C1C1E] overflow-hidden">
          {error && (
            <div className="m-4 flex items-center justify-between rounded-xl border border-[#FF3B30]/20 bg-[#FFECEB] p-3 text-xs text-[#CC2B22] dark:border-[#FF453A]/20 dark:bg-[#2E0A09] dark:text-[#FF453A]">
              <div className="flex items-center gap-2">
                <AlertTriangleIcon size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fetchSalespeople()}
              >
                Retry
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="md" className="text-[#0071E3]" />
            </div>
          ) : salespeople.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <div className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                No salespeople found
              </div>
              <p className="text-xs text-[#86868B] max-w-sm mx-auto">
                {searchQuery
                  ? `No salespeople matching "${searchQuery}".`
                  : includeInactive
                    ? 'No salespeople exist in the system.'
                    : 'No active salespeople found. Check "Show inactive" or add a new salesperson.'}
              </p>
              {isAdmin && !searchQuery && (
                <div className="pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsCreateModalOpen(true)}
                  >
                    Add First Salesperson
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E8E8ED] bg-[#F5F5F7] font-semibold text-[#6E6E73] dark:border-[#2C2C2E] dark:bg-[#2C2C2E]/50 dark:text-[#86868B]">
                    <tr>
                      <th className="px-5 py-3">Salesperson Name</th>
                      <th className="px-5 py-3">Phone</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Created Date</th>
                      {isAdmin && (
                        <th className="px-5 py-3 text-right">Action</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E8ED] text-[#1D1D1F] dark:divide-[#2C2C2E] dark:text-[#F5F5F7]">
                    {salespeople.map((sp) => (
                      <tr
                        key={sp.id}
                        className="transition-colors hover:bg-[#F5F5F7]/60 dark:hover:bg-[#2C2C2E]/40"
                      >
                        <td className="px-5 py-3.5 font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {sp.name}
                        </td>
                        <td className="px-5 py-3.5 text-[#6E6E73] dark:text-[#86868B]">
                          {sp.phone || '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          {sp.isActive ? (
                            <Badge variant="success" size="sm">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="neutral" size="sm">
                              Inactive
                            </Badge>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right text-[11px] text-[#86868B]">
                          {formatDate(sp.createdAt)}
                        </td>
                        {isAdmin && (
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => setEditingSalesperson(sp)}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#0071E3] hover:bg-[#0071E3]/10 dark:text-[#2997FF] dark:hover:bg-[#2997FF]/10 transition-colors"
                              title="Edit salesperson"
                            >
                              <EditIcon size={14} />
                              <span>Edit</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List */}
              <div className="block md:hidden divide-y divide-[#E8E8ED] dark:divide-[#2C2C2E]">
                {salespeople.map((sp) => (
                  <div key={sp.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-bold text-xs text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {sp.name}
                        </span>
                        <div className="text-[11px] text-[#86868B] mt-0.5">
                          Phone: {sp.phone || '—'}
                        </div>
                      </div>
                      {sp.isActive ? (
                        <Badge variant="success" size="sm">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">
                          Inactive
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[#E8E8ED]/60 dark:border-[#2C2C2E]/60 text-[10px] text-[#86868B]">
                      <span>Added: {formatDate(sp.createdAt)}</span>

                      {isAdmin && (
                        <button
                          onClick={() => setEditingSalesperson(sp)}
                          className="inline-flex items-center gap-1 font-semibold text-[#0071E3] dark:text-[#2997FF]"
                        >
                          <EditIcon size={12} />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Create Modal */}
        <CreateSalespersonModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={fetchSalespeople}
        />

        {/* Edit Modal */}
        <EditSalespersonModal
          salesperson={editingSalesperson}
          isOpen={!!editingSalesperson}
          onClose={() => setEditingSalesperson(null)}
          onSuccess={fetchSalespeople}
        />
      </div>
    </AppShell>
  );
}
