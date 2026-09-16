'use client';

import React, { useEffect, useState } from 'react';
import { Salesperson } from '../../types/api';
import { salespeopleService } from '../../services/salespeople.service';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { CloseIcon, AlertTriangleIcon } from '../ui/Icons';

interface EditSalespersonModalProps {
  salesperson: Salesperson | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditSalespersonModal: React.FC<EditSalespersonModalProps> = ({
  salesperson,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (salesperson) {
      setName(salesperson.name ?? '');
      setPhone(salesperson.phone ?? '');
      setIsActive(salesperson.isActive ?? true);
      setError(null);
    }
  }, [salesperson]);

  if (!isOpen || !salesperson) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Salesperson name is required.');
      return;
    }

    setIsLoading(true);
    try {
      await salespeopleService.updateSalesperson(salesperson.id, {
        name: trimmedName,
        phone: phone.trim() || undefined,
        isActive,
      });
      onClose();
      onSuccess();
    } catch (err: unknown) {
      setError(
        (err as { message?: string })?.message ??
          'Failed to update salesperson.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-[#D2D2D7] bg-white shadow-xl dark:border-[#38383A] dark:bg-[#1C1C1E]">
        <div className="flex items-center justify-between border-b border-[#E8E8ED] px-4 py-3 dark:border-[#2C2C2E]">
          <div>
            <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Edit Salesperson
            </h3>
            <p className="mt-0.5 text-[11px] text-[#6E6E73] dark:text-[#86868B]">
              {salesperson.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[#86868B] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] dark:hover:bg-[#2C2C2E]"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
          {error && (
            <div className="rounded-xl border border-[#FF3B30]/20 bg-[#FFECEB] px-3 py-2 text-xs text-[#CC2B22] dark:border-[#FF453A]/20 dark:bg-[#2E0A09] dark:text-[#FF453A]">
              {error}
            </div>
          )}

          <Input
            label="Salesperson Name *"
            placeholder="e.g. Abel Tesfaye"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Phone Number"
            placeholder="e.g. 0911000000 (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          {/* Active Status Toggle */}
          <div className="rounded-xl border border-[#E8E8ED] bg-[#F5F5F7] p-3 dark:border-[#2C2C2E] dark:bg-[#2C2C2E]/60 space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="edit-salesperson-active"
                className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] cursor-pointer select-none"
              >
                Active Status
              </label>
              <input
                id="edit-salesperson-active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-[#D2D2D7] text-[#0071E3] focus:ring-[#0071E3] cursor-pointer"
              />
            </div>
            <p className="text-[11px] text-[#6E6E73] dark:text-[#86868B]">
              {isActive
                ? 'Active salespeople are listed when allocating product stock from Main Shop.'
                : 'Inactive salespeople cannot receive new stock allocations, but historical allocation records remain fully preserved.'}
            </p>
          </div>

          {!isActive && (
            <div className="flex items-start gap-2 rounded-xl border border-[#FF9F0A]/30 bg-[#FFF9F0] p-3 text-xs text-[#9E6200] dark:border-[#FF9F0A]/20 dark:bg-[#2E1F0A] dark:text-[#FF9F0A]">
              <AlertTriangleIcon size={14} className="shrink-0 mt-0.5" />
              <span>
                Deactivating this salesperson hides them from new stock allocations. Record history is NOT deleted.
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              isLoading={isLoading}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
