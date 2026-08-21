'use client';

import React, { useState } from 'react';
import { Category } from '../../types/api';
import { categoryService, CreateCategoryRequest } from '../../services/category.service';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { CloseIcon } from '../ui/Icons';

interface CreateCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newCategory: Category) => void;
}

export const CreateCategoryModal: React.FC<CreateCategoryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePresetClick = (presetName: string) => {
    setName(presetName);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Category name is required.');
      return;
    }

    setIsLoading(true);
    try {
      const payload: CreateCategoryRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
      };
      const created = await categoryService.createCategory(payload);
      setName('');
      setDescription('');
      onSuccess(created);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create category.');
    } finally {
      setIsLoading(false);
    }
  };

  const presets = [
    'Screens',
    'ICs',
    'Batteries',
    'Charging Ports',
    'Flex Cables',
    'Speakers',
    'Connectors',
    'Accessories',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Add Inventory Category
            </h3>
            <p className="text-xs text-slate-500">
              Create a category for organizing phones, repair stock, or accessories
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <Input
            label="Category Name *"
            placeholder="e.g. Screens, ICs, Batteries"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          {/* Quick Presets for Yonas Mobile */}
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Quick Category Presets:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetClick(preset)}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                >
                  + {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-slate-400"
              placeholder="e.g. Mobile phone display assemblies and touchscreens..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isLoading}>
              Create Category
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
