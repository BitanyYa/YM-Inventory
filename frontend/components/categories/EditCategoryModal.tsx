'use client';

import React, { useEffect, useState } from 'react';
import { Category } from '../../types/api';
import { categoryService, UpdateCategoryRequest } from '../../services/category.service';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { CloseIcon } from '../ui/Icons';

interface EditCategoryModalProps {
  category: Category | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedCategory: Category) => void;
}

export const EditCategoryModal: React.FC<EditCategoryModalProps> = ({ category, isOpen, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (category) { setName(category.name ?? ''); setDescription(category.description ?? ''); }
  }, [category]);

  if (!isOpen || !category) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError('Category name is required.'); return; }
    setIsLoading(true);
    try {
      const payload: UpdateCategoryRequest = { name: name.trim(), description: description.trim() || undefined };
      const updated = await categoryService.updateCategory(category.id, payload);
      onSuccess(updated); onClose();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Failed to update category.');
    } finally { setIsLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-[#D2D2D7] bg-white shadow-xl dark:border-[#38383A] dark:bg-[#1C1C1E]">

        <div className="flex items-start justify-between border-b border-[#E8E8ED] px-4 py-3 dark:border-[#2C2C2E]">
          <div>
            <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Edit Category</h3>
            <p className="mt-0.5 text-[11px] text-[#6E6E73]">{category.name}</p>
          </div>
          <button onClick={onClose} className="ml-3 rounded-lg p-1 text-[#86868B] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] dark:hover:bg-[#2C2C2E]">
            <CloseIcon size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 py-3 space-y-3">
          {error && (
            <div className="rounded-lg border border-[#FF3B30]/20 bg-[#FFECEB] px-3 py-2 text-xs text-[#CC2B22] dark:border-[#FF453A]/20 dark:bg-[#2E0A09] dark:text-[#FF453A]">
              {error}
            </div>
          )}

          <Input label="Category Name *" placeholder="e.g. Screens, Batteries, ICs"
            value={name} onChange={(e) => setName(e.target.value)} required />

          <div>
            <label className="block text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">
              Description <span className="text-[#86868B]">(optional)</span>
            </label>
            <textarea rows={2}
              className="w-full rounded-lg border border-[#D2D2D7] bg-white px-3 py-1.5 text-sm text-[#1D1D1F] placeholder:text-[#AEAEB2] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/50 focus:border-[#0071E3] dark:border-[#38383A] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]"
              placeholder="Brief description…"
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" type="button" onClick={onClose} disabled={isLoading}>Cancel</Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isLoading}>Save Category</Button>
          </div>
        </form>
      </div>
    </div>
  );
};
