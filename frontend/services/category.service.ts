import { apiClient } from '../lib/api-client';
import { Category } from '../types/api';

export const categoryService = {
  async getCategories(): Promise<Category[]> {
    return apiClient<Category[]>('/categories');
  },
};
