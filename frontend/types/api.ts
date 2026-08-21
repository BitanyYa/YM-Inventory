export type UserRole = 'PRIMARY_ADMIN' | 'ADMIN' | 'USER';
export type MovementType =
  | 'STOCK_IN'
  | 'TRANSFER'
  | 'SALE'
  | 'RETURN'
  | 'DAMAGE'
  | 'LOSS';
export type Location = 'WAREHOUSE' | 'SHOP';
export type ProductType =
  | 'PHONE'
  | 'ACCESSORY'
  | 'TABLET'
  | 'LAPTOP'
  | 'SMART_WATCH'
  | 'OTHER';
export type TrackingType = 'QUANTITY' | 'SERIALIZED';
export type InventoryStockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/* Dashboard / Summary Types */
export interface InventorySummary {
  warehouseQuantity: number;
  shopQuantity: number;
  totalQuantity: number;
}

export interface SerializedUnitsSummary {
  warehouseAvailable: number;
  shopAvailable: number;
  totalAvailable: number;
}

export interface ProductSummary {
  total: number;
  active: number;
  inactive: number;
  outOfStock: number;
  lowStock: number;
  inStock: number;
}

export interface MovementSummary {
  stockIn: number;
  transfers: number;
  sales: number;
  returns: number;
  damages: number;
  losses: number;
  total: number;
}

export interface SalesSummary {
  totalTransactions: number;
  totalQuantity: number;
  totalRevenue: number;
}

export interface ReturnsSummary {
  totalTransactions: number;
  totalQuantity: number;
}

export interface AlertsSummary {
  lowStockProducts: number;
  outOfStockProducts: number;
}

export interface StockSummaryData {
  inventory: InventorySummary;
  serializedUnits: SerializedUnitsSummary;
  products: ProductSummary;
  movements: MovementSummary;
  sales: SalesSummary;
  returns: ReturnsSummary;
  alerts: AlertsSummary;
}

export interface StockSummaryResponse {
  data: StockSummaryData;
}

/* Inventory Alert Types */
export interface InventoryAlertProduct {
  id: string;
  name: string;
  brand: string;
  productType: ProductType;
  trackingType: TrackingType;
  sellingPrice: number;
  minimumStock: number;
  isActive: boolean;
  category?: {
    id: string;
    name: string;
  } | null;
}

export interface InventoryAlert {
  product: InventoryAlertProduct;
  inventory: InventorySummary;
  unitSummary?: SerializedUnitsSummary | null;
  stockStatus: InventoryStockStatus;
  shortage: number;
}

export interface InventoryAlertsResponse {
  data: InventoryAlert[];
  meta: PaginationMeta;
}

/* Stock Movement Types */
export interface StockMovementProduct {
  id: string;
  name: string;
  brand: string;
  productType: ProductType;
  trackingType: TrackingType;
  sellingPrice?: number;
}

export interface StockMovementUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface StockMovementUnitItem {
  id: string;
  imei?: string | null;
  serialNumber?: string | null;
  storage?: string | null;
  color?: string | null;
  purchasePrice?: number | null;
  location: Location;
  status: string;
}

export interface StockMovementItem {
  id: string;
  productId: string;
  movementType: MovementType;
  fromLocation?: Location | null;
  toLocation?: Location | null;
  quantity: number;
  costPrice?: number | null;
  note?: string | null;
  createdById: string;
  createdAt: string;
  product: StockMovementProduct;
  createdBy?: StockMovementUser;
  units?: StockMovementUnitItem[];
}

export interface StockMovementsResponse {
  data: StockMovementItem[];
  meta: PaginationMeta;
}
