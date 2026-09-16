'use client';

import React, { useState } from 'react';
import { Salesperson } from '../../types/api';
import { salespeopleService } from '../../services/salespeople.service';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { CloseIcon } from '../ui/Icons';

interface CreateSalespersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (createdSalesperson?: Salesperson) => void;
}

export const CreateSalespersonModal: React.FC<CreateSalespersonModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setName('');
    setPhone('');
    setError(null);
    onClose();
  };

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
      const created = await salespeopleService.createSalesperson({
        name: trimmedName,
        phone: phone.trim() || undefined,
      });
      handleClose();
      onSuccess(created);
    } catch (err: unknown) {
      setError(
        (err as { message?: string })?.message ??
          'Failed to create salesperson.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-[#D2D2D7] bg-white shadow-xl dark:border-[#38383A] dark:bg-[#1C1C1E]">
        <div className="flex items-center justify-between border-b border-[#E8E8ED] px-4 py-3 dark:border-[#2C2C2E]">
          <div>
            <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Add Salesperson
            </h3>
            <p className="mt-0.5 text-[11px] text-[#6E6E73] dark:text-[#86868B]">
              Add a person who can receive stock allocations from Main Shop.
            </p>
          </div>
          <button
            onClick={handleClose}
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
            autoFocus
          />

          <Input
            label="Phone Number"
            placeholder="e.g. 0911000000 (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={handleClose}
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
              Add Salesperson
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
