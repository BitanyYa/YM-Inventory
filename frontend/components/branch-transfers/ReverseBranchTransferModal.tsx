'use client';

import React, { useEffect, useState } from 'react';
import { BranchTransferItem, ReverseBranchTransferResponse } from '../../types/api';
import { branchTransfersService } from '../../services/branch-transfers.service';
import { inventoryService, invalidateInventoryCache } from '../../services/inventory.service';
import { productService } from '../../services/product.service';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  AlertTriangleIcon,
  CloseIcon,
  RotateCcwIcon,
} from '../ui/Icons';

interface ReverseBranchTransferModalProps {
  isOpen: boolean;
  transfer: BranchTransferItem | null;
  onClose: () => void;
  onSuccess: (response?: ReverseBranchTransferResponse) => void;
}

export const ReverseBranchTransferModal: React.FC<ReverseBranchTransferModalProps> = ({
  isOpen,
  transfer,
  onClose,
  onSuccess,
}) => {
  const [quantity, setQuantity] = useState<string>('1');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && transfer) {
      const remaining = transfer.remainingQuantity ?? (transfer.quantity - (transfer.reversedQuantity ?? 0));
      setQuantity(remaining > 0 ? '1' : '0');
      setReason('');
      setError(null);
      setShowConfirmation(false);
    }
  }, [isOpen, transfer]);

  if (!isOpen || !transfer) return null;

  const originalQty = transfer.quantity;
  const alreadyReversedQty = transfer.reversedQuantity ?? 0;
  const remainingQty = transfer.remainingQuantity ?? (originalQty - alreadyReversedQty);

  const numQuantity = parseInt(quantity, 10);
  const isQuantityValid =
    !isNaN(numQuantity) &&
    Number.isInteger(numQuantity) &&
    numQuantity >= 1 &&
    numQuantity <= remainingQty;

  const trimmedReason = reason.trim();
  const isReasonValid = trimmedReason.length >= 3;
  const isFormValid = isQuantityValid && isReasonValid && remainingQty > 0;

  const resetForm = () => {
    setQuantity('1');
    setReason('');
    setError(null);
    setShowConfirmation(false);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    setShowConfirmation(true);
  };

  const handleSubmitReversal = async () => {
    if (!isFormValid) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await branchTransfersService.reverseBranchTransfer({
        branchTransferId: transfer.id,
        quantity: numQuantity,
        reason: trimmedReason,
      });

      invalidateInventoryCache();
      productService.clearCache();
      resetForm();
      onSuccess(res);
      onClose();
    } catch (err: unknown) {
      const errorMsg =
        (err as { message?: string | string[] })?.message ||
        (Array.isArray((err as { message?: string[] })?.message)
          ? ((err as { message: string[] }).message).join(', ')
          : 'Failed to reverse branch transfer.');

      const displayMessage = Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg;
      setError(displayMessage);
      setShowConfirmation(false);
      // Refresh transfer & inventory data in background if requested quantity exceeded state
      onSuccess();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal Window */}
      <div className="relative w-full max-w-md rounded-2xl border border-[#D2D2D7] bg-white shadow-2xl dark:border-[#38383A] dark:bg-[#1C1C1E] overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#E8E8ED] px-5 py-4 dark:border-[#2C2C2E]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF9F0A]/10 text-[#FF9F0A] dark:bg-[#FF9F0A]/20">
              <RotateCcwIcon size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Reverse Branch Transfer
              </h3>
              <p className="mt-0.5 text-xs text-[#6E6E73] dark:text-[#86868B]">
                Return transferred stock from physical branch to Main Shop.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="ml-3 rounded-lg p-1 text-[#86868B] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] dark:hover:bg-[#2C2C2E]"
            aria-label="Close modal"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Error Banner */}
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-[#FF3B30]/20 bg-[#FFECEB] p-3 text-xs text-[#CC2B22] dark:border-[#FF453A]/20 dark:bg-[#2E0A09] dark:text-[#FF453A]">
              <AlertTriangleIcon size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Context Banner: Destination explanation */}
          <div className="rounded-xl border border-[#FF9F0A]/30 bg-[#FFF9F0] p-3 text-xs text-[#9E6200] dark:border-[#FF9F0A]/20 dark:bg-[#2E1F0A] dark:text-[#FF9F0A] flex items-start gap-2">
            <RotateCcwIcon size={15} className="mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold block">Stock Movement Notice</span>
              <span>Stock will be returned to Main Shop upon reversal.</span>
            </div>
          </div>

          {/* Transfer Info Card */}
          <div className="rounded-xl border border-[#E8E8ED] bg-[#F5F5F7] p-3.5 space-y-2 dark:border-[#2C2C2E] dark:bg-[#2C2C2E]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#6E6E73] dark:text-[#86868B]">Branch</span>
              <span className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                {transfer.branch.name}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-[#6E6E73] dark:text-[#86868B]">Product</span>
              <span className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                {transfer.product.name} ({transfer.product.brand})
              </span>
            </div>

            <div className="pt-2 border-t border-[#E8E8ED] dark:border-[#38383A] grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-white p-2 dark:bg-[#1C1C1E]">
                <span className="block text-[10px] text-[#86868B]">Transferred</span>
                <span className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {originalQty}
                </span>
              </div>
              <div className="rounded-lg bg-white p-2 dark:bg-[#1C1C1E]">
                <span className="block text-[10px] text-[#86868B]">Reversed</span>
                <span className="font-bold text-[#FF9F0A]">
                  {alreadyReversedQty}
                </span>
              </div>
              <div className="rounded-lg bg-white p-2 dark:bg-[#1C1C1E]">
                <span className="block text-[10px] text-[#86868B]">Remaining</span>
                <span className="font-bold text-[#0071E3] dark:text-[#2997FF]">
                  {remainingQty}
                </span>
              </div>
            </div>
          </div>

          {/* Form Step or Confirmation Step */}
          {!showConfirmation ? (
            <form onSubmit={handleProceedToConfirm} className="space-y-4">
              {/* Quantity Input */}
              <div>
                <Input
                  label={`Quantity to reverse * (max ${remainingQty})`}
                  type="number"
                  min={1}
                  max={remainingQty}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={isSubmitting || remainingQty <= 0}
                  required
                />
                {!isNaN(numQuantity) && numQuantity > remainingQty && (
                  <p className="mt-1 text-[11px] font-medium text-[#FF3B30] dark:text-[#FF453A]">
                    Quantity cannot exceed remaining transferred quantity ({remainingQty}).
                  </p>
                )}
                {!isNaN(numQuantity) && numQuantity < 1 && (
                  <p className="mt-1 text-[11px] font-medium text-[#FF3B30] dark:text-[#FF453A]">
                    Quantity must be at least 1.
                  </p>
                )}
              </div>

              {/* Reason Textarea */}
              <div>
                <label
                  htmlFor="branch-reversal-reason"
                  className="block text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] mb-1"
                >
                  Reason * <span className="text-[#86868B]">(min 3 characters)</span>
                </label>
                <textarea
                  id="branch-reversal-reason"
                  rows={2}
                  className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3 py-2 text-xs text-[#1D1D1F] placeholder:text-[#86868B] focus:border-[#0071E3] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 dark:border-[#38383A] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]"
                  placeholder="e.g. Transferred too many units to branch by mistake"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
                {reason.length > 0 && !isReasonValid && (
                  <p className="mt-1 text-[11px] font-medium text-[#FF3B30] dark:text-[#FF453A]">
                    Reason must contain at least 3 characters.
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8E8ED] dark:border-[#2C2C2E]">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={!isFormValid || isSubmitting}
                  className="bg-[#FF9F0A] hover:bg-[#D98200] text-white border-none"
                >
                  Continue to Confirm
                </Button>
              </div>
            </form>
          ) : (
            /* Confirmation Step */
            <div className="space-y-4 rounded-xl border border-[#FF9F0A]/30 bg-[#FFF9F0]/50 p-4 dark:border-[#FF9F0A]/20 dark:bg-[#2E1F0A]/40">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF9F0A]/20 text-[#9E6200] dark:text-[#FF9F0A]">
                  <AlertTriangleIcon size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    Confirm Reversal Action
                  </h4>
                  <p className="mt-1 text-xs text-[#6E6E73] dark:text-[#86868B] leading-relaxed">
                    You are about to reverse <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{numQuantity} unit(s)</strong> of <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{transfer.product.name}</strong> from branch <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{transfer.branch.name}</strong> back to <strong className="text-[#0071E3] dark:text-[#2997FF]">Main Shop</strong>.
                  </p>
                  <p className="mt-1 text-[11px] italic text-[#86868B]">
                    Reason: &quot;{trimmedReason}&quot;
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#FF9F0A]/20">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setShowConfirmation(false)}
                  disabled={isSubmitting}
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="button"
                  isLoading={isSubmitting}
                  disabled={isSubmitting}
                  onClick={handleSubmitReversal}
                  className="bg-[#FF9F0A] hover:bg-[#D98200] text-white border-none"
                >
                  Confirm &amp; Reverse Transfer
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
