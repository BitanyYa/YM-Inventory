import { apiClient } from '../lib/api-client';
import {
  CreateSalespersonRequest,
  QuerySalespeopleParams,
  Salesperson,
  UpdateSalespersonRequest,
} from '../types/api';

export const salespeopleService = {
  async getSalespeople(
    params: QuerySalespeopleParams = {},
  ): Promise<Salesperson[]> {
    const q = new URLSearchParams();
    if (params.search && params.search.trim()) {
      q.append('search', params.search.trim());
    }
    if (params.includeInactive !== undefined) {
      q.append('includeInactive', params.includeInactive.toString());
    }

    const queryString = q.toString();
    const endpoint = `/salespeople${queryString ? `?${queryString}` : ''}`;
    return apiClient<Salesperson[]>(endpoint);
  },

  async createSalesperson(
    data: CreateSalespersonRequest,
  ): Promise<Salesperson> {
    return apiClient<Salesperson>('/salespeople', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getSalesperson(id: string): Promise<Salesperson> {
    return apiClient<Salesperson>(`/salespeople/${id}`);
  },

  async updateSalesperson(
    id: string,
    data: UpdateSalespersonRequest,
  ): Promise<Salesperson> {
    return apiClient<Salesperson>(`/salespeople/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};
