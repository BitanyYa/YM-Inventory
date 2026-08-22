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

export const EditCategoryModal: React.FC<EditCategoryModalProps> = ({
  category,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (category) {
      setName(category.name ?? '');
      setDescription(category.description ?? '');
    }
  }, [category]);

  if (!isOpen || !category) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError('Category name is required.'); return; }
    setIsLoading(true);
    try {
      const payload: UpdateCategoryRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
      };
      const updated = await categoryService.updateCategory(category.id, payload);
      onSuccess(updated);
      onClose();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Failed to update category.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />

      <div className="relative w-full max-w-sm rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">

        {/* header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Edit Category</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">{category.name}</p>
          </div>
          <button onClick={onClose} className="ml-3 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
            <CloseIcon size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 py-3 space-y-3">

          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </div>
          )}

          <Input
            label="Category Name *"
            placeholder="e.g. Screens, Batteries, ICs"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Description <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              rows={2}
              className="w-full rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              placeholder="Brief description…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" type="button" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isLoading}>
              Save Category
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
