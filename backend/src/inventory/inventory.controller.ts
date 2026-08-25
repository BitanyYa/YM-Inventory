import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { InventoryService } from './inventory.service';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { QueryLowStockDto } from './dto/query-low-stock.dto';
import { QueryProductMovementDto } from './dto/query-product-movement.dto';
import { QueryStockAlertDto } from './dto/query-stock-alert.dto';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { QueryInventoryAlertDto } from './dto/query-inventory-alert.dto';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Get current inventory summary statistics' })
  @ApiResponse({
    status: 200,
    description:
      'Current inventory statistics (totalProducts, totalUnits, warehouseUnits, shopUnits, lowStockProducts, outOfStockProducts, breakdowns, lowStockItems)',
  })
  async getSummary() {
    return this.inventoryService.getSummary();
  }

  @Get('low-stock')
  @Roles(UserRole.ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Get low-stock products (at or below minimum stock)' })
  @ApiResponse({
    status: 200,
    description: 'Products currently at or below minimum stock',
  })
  async getLowStock(@Query() query: QueryLowStockDto) {
    return this.inventoryService.getLowStock(query);
  }

  @Get('alerts')
  @Roles(UserRole.ADMIN, UserRole.USER)
  @ApiOperation({
    summary:
      'Get products currently LOW_STOCK or OUT_OF_STOCK sorted by urgency with calculated shortage (supports alertType, page, limit, productId, categoryId, productType, trackingType, location, search)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated stock alerts retrieved successfully sorted by urgency with metadata',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error (e.g. alertType=IN_STOCK or invalid query parameter format)',
  })
  async getInventoryAlerts(@Query() query: QueryInventoryAlertDto) {
    return this.inventoryService.getInventoryAlerts(query);
  }

  @Get('alerts/stock')
  @Roles(UserRole.ADMIN, UserRole.USER)
  @ApiOperation({
    summary:
      'Get low stock & out-of-stock reorder report (supports status filter, search, productType, trackingType, location, categoryId, page, limit)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated stock alerts retrieved successfully sorted by urgency',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error (e.g. invalid status enum)',
  })
  async getStockAlerts(@Query() query: QueryStockAlertDto) {
    return this.inventoryService.getStockAlerts(query);
  }

  @Post('adjust')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Adjust physical inventory quantity for QUANTITY-tracked products (Admin only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Inventory successfully adjusted and stock movement recorded',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error, inactive product, serialized product, or zero adjustment',
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async adjustInventory(
    @Body() dto: AdjustInventoryDto,
    @GetUser('id') userId: string,
  ) {
    return this.inventoryService.adjustInventory(dto, userId);
  }

  @Get('products/:productId/movements')
  @Roles(UserRole.ADMIN, UserRole.USER)
  @ApiOperation({
    summary:
      'Get paginated stock movement history for ONE specific product by ID (supports movementType, fromLocation, toLocation, date, startDate, endDate)',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiResponse({
    status: 200,
    description: 'Product movement history retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async getProductMovementHistory(
    @Param('productId') productId: string,
    @Query() query: QueryProductMovementDto,
  ) {
    return this.inventoryService.getProductMovementHistory(productId, query);
  }

  @Get('products/:productId')
  @Roles(UserRole.ADMIN, UserRole.USER)
  @ApiOperation({
    summary:
      'Get complete current stock state, unit summary, and active serialized units for ONE product by ID',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiResponse({
    status: 200,
    description: 'Product inventory state retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async getProductInventoryDetail(@Param('productId') productId: string) {
    return this.inventoryService.getProductInventoryDetail(productId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.USER)
  @ApiOperation({
    summary:
      'Get paginated & filterable inventory list (supports page, limit, stockStatus, search, productType, trackingType, location, productId, categoryId, isActive)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated inventory state retrieved successfully with metadata',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters (e.g. page < 1, limit < 1, limit > 100, or invalid status/enum format)',
  })
  async getInventory(@Query() query: QueryInventoryDto) {
    return this.inventoryService.findInventory(query);
  }
}
