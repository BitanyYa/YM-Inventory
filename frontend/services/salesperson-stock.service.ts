import { apiClient } from '../lib/api-client';
import {
  AllocateProductRequest,
  AllocateProductResponse,
  ProductAllocationListResponse,
  QueryProductAllocationParams,
  QuerySalespersonStockParams,
  SalespersonStockItem,
  User,
} from '../types/api';

export const salespersonStockService = {
  async allocateProduct(data: AllocateProductRequest): Promise<AllocateProductResponse> {
    return apiClient<AllocateProductResponse>('/salesperson-stock/allocate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getSalespersonStock(params: QuerySalespersonStockParams = {}): Promise<SalespersonStockItem[]> {
    const q = new URLSearchParams();
    if (params.salespersonId) q.append('salespersonId', params.salespersonId);
    if (params.productId) q.append('productId', params.productId);

    const queryString = q.toString();
    const endpoint = `/salesperson-stock${queryString ? `?${queryString}` : ''}`;
    return apiClient<SalespersonStockItem[]>(endpoint);
  },

  async getSalespersonStockBySalesperson(salespersonId: string): Promise<{
    salesperson: User;
    stocks: Array<{
      id: string;
      product: {
        id: string;
        name: string;
        brand: string;
        productType: string;
        sellingPrice: number;
        category?: { id: string; name: string } | null;
      };
      quantity: number;
      updatedAt: string;
    }>;
  }> {
    return apiClient(`/salesperson-stock/${salespersonId}`);
  },

  async getAllocations(params: QueryProductAllocationParams = {}): Promise<ProductAllocationListResponse> {
    const q = new URLSearchParams();
    if (params.page) q.append('page', params.page.toString());
    if (params.limit) q.append('limit', params.limit.toString());
    if (params.salespersonId) q.append('salespersonId', params.salespersonId);
    if (params.productId) q.append('productId', params.productId);

    const queryString = q.toString();
    const endpoint = `/salesperson-stock/allocations${queryString ? `?${queryString}` : ''}`;
    return apiClient<ProductAllocationListResponse>(endpoint);
  },

  async getUsers(): Promise<User[]> {
    return apiClient<User[]>('/users');
  },
};
