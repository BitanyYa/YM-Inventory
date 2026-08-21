import { apiClient } from '../lib/api-client';
import {
  StockSummaryResponse,
  InventoryAlertsResponse,
  StockMovementsResponse,
} from '../types/api';

export const dashboardService = {
  async getSummary(): Promise<StockSummaryResponse> {
    return apiClient<StockSummaryResponse>('/stock/summary');
  },

  async getAlerts(limit: number = 5): Promise<InventoryAlertsResponse> {
    return apiClient<InventoryAlertsResponse>(`/inventory/alerts?limit=${limit}`);
  },

  async getRecentMovements(limit: number = 5): Promise<StockMovementsResponse> {
    return apiClient<StockMovementsResponse>(`/stock/movements?limit=${limit}`);
  },
};
