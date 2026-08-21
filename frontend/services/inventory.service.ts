import { apiClient } from '../lib/api-client';
import {
  InventoryListResponse,
  InventorySummaryResponse,
  QueryInventoryParams,
  ReceiveStockRequest,
  TransferStockRequest,
  SellStockRequest,
  ReturnStockRequest,
  DamageLossStockRequest,
  ProductDetailResponse,
} from '../types/api';

export const inventoryService = {
  /**
   * GET /inventory
   * Paginated product list with live warehouse/shop quantities.
   */
  async getInventory(params: QueryInventoryParams = {}): Promise<InventoryListResponse> {
    const q = new URLSearchParams();
    if (params.page) q.append('page', params.page.toString());
    if (params.limit) q.append('limit', params.limit.toString());
    if (params.search?.trim()) q.append('search', params.search.trim());
    if (params.categoryId) q.append('categoryId', params.categoryId);
    if (params.productType) q.append('productType', params.productType);
    if (params.trackingType) q.append('trackingType', params.trackingType);
    if (params.location) q.append('location', params.location);
    if (params.stockStatus) q.append('stockStatus', params.stockStatus);
    // Always fetch active products by default
    if (params.isActive !== undefined) {
      q.append('isActive', params.isActive.toString());
    }
    const qs = q.toString();
    return apiClient<InventoryListResponse>(`/inventory${qs ? `?${qs}` : ''}`);
  },

  /**
   * GET /inventory/summary
   * Aggregate counts: total products, warehouse units, shop units, alerts.
   */
  async getInventorySummary(): Promise<InventorySummaryResponse> {
    return apiClient<InventorySummaryResponse>('/inventory/summary');
  },

  /**
   * GET /inventory/products/:productId
   * Detailed inventory view for a single product (used in modals to load units).
   */
  async getProductInventoryDetail(productId: string): Promise<ProductDetailResponse> {
    return apiClient<ProductDetailResponse>(`/inventory/products/${productId}`);
  },

  /* ─── Stock Mutations ───────────────────────────────────────────────────── */

  /**
   * POST /stock/receive
   * Receive new stock into WAREHOUSE.
   */
  async receiveStock(data: ReceiveStockRequest): Promise<void> {
    await apiClient<unknown>('/stock/receive', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * POST /stock/transfer
   * Transfer stock from WAREHOUSE → SHOP.
   */
  async transferStock(data: TransferStockRequest): Promise<void> {
    await apiClient<unknown>('/stock/transfer', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * POST /stock/sell
   * Sell stock from SHOP.
   */
  async sellStock(data: SellStockRequest): Promise<void> {
    await apiClient<unknown>('/stock/sell', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * POST /stock/return
   * Return sold stock back to WAREHOUSE or SHOP.
   */
  async returnStock(data: ReturnStockRequest): Promise<void> {
    await apiClient<unknown>('/stock/return', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * POST /stock/damage
   * Mark stock as damaged at a specific location.
   */
  async damageStock(data: DamageLossStockRequest): Promise<void> {
    await apiClient<unknown>('/stock/damage', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * POST /stock/loss
   * Record a stock loss at a specific location.
   */
  async lossStock(data: DamageLossStockRequest): Promise<void> {
    await apiClient<unknown>('/stock/loss', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
