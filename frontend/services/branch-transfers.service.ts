import { apiClient } from '../lib/api-client';
import {
  Branch,
  BranchInventoryItem,
  BranchTransferListResponse,
  CreateBranchTransferRequest,
  CreateBranchTransferResponse,
  QueryBranchInventoryParams,
  QueryBranchTransferParams,
  ReverseBranchTransferRequest,
  ReverseBranchTransferResponse,
} from '../types/api';

export const branchTransfersService = {
  /**
   * GET /branch-transfers/branches
   * Retrieve list of active physical branches (Atlas, Aberus, Garad).
   */
  async getBranches(): Promise<Branch[]> {
    return apiClient<Branch[]>('/branch-transfers/branches');
  },

  /**
   * POST /branch-transfers
   * Perform a stock transfer from Main Shop (SHOP) to a target Branch.
   */
  async transferToBranch(
    data: CreateBranchTransferRequest,
  ): Promise<CreateBranchTransferResponse> {
    return apiClient<CreateBranchTransferResponse>('/branch-transfers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * POST /branch-transfers/transfers/reverse
   * Reverse stock from a target Branch back to Main Shop (SHOP).
   */
  async reverseBranchTransfer(
    data: ReverseBranchTransferRequest,
  ): Promise<ReverseBranchTransferResponse> {
    return apiClient<ReverseBranchTransferResponse>('/branch-transfers/transfers/reverse', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * GET /branch-transfers/inventory
   * Retrieve current stock balance per branch and product.
   */
  async getBranchInventory(
    params: QueryBranchInventoryParams = {},
  ): Promise<BranchInventoryItem[]> {
    const q = new URLSearchParams();
    if (params.branchId) q.append('branchId', params.branchId);
    if (params.productId) q.append('productId', params.productId);

    const queryString = q.toString();
    const endpoint = `/branch-transfers/inventory${queryString ? `?${queryString}` : ''}`;
    return apiClient<BranchInventoryItem[]>(endpoint);
  },

  /**
   * GET /branch-transfers
   * Retrieve paginated history of branch transfer events.
   */
  async getBranchTransfers(
    params: QueryBranchTransferParams = {},
  ): Promise<BranchTransferListResponse> {
    const q = new URLSearchParams();
    if (params.page) q.append('page', params.page.toString());
    if (params.limit) q.append('limit', params.limit.toString());
    if (params.branchId) q.append('branchId', params.branchId);
    if (params.productId) q.append('productId', params.productId);

    const queryString = q.toString();
    const endpoint = `/branch-transfers${queryString ? `?${queryString}` : ''}`;
    return apiClient<BranchTransferListResponse>(endpoint);
  },
};
