import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InventoryService } from './inventory.service';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { QueryLowStockDto } from './dto/query-low-stock.dto';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get current inventory summary statistics' })
  @ApiResponse({
    status: 200,
    description: 'Current inventory statistics (totalProducts, totalUnits, warehouseUnits, shopUnits, lowStockProducts, outOfStockProducts)',
  })
  async getSummary() {
    return this.inventoryService.getSummary();
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Get low-stock products (at or below minimum stock)' })
  @ApiResponse({
    status: 200,
    description: 'Products currently at or below minimum stock',
  })
  async getLowStock(@Query() query: QueryLowStockDto) {
    return this.inventoryService.getLowStock(query);
  }

  @Get()
  @ApiOperation({
    summary:
      'Get current inventory state (warehouse & shop stock, total quantity, low stock status, and product units for serialized products)',
  })
  @ApiResponse({
    status: 200,
    description: 'Current inventory state retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters (e.g. invalid enum or boolean format)',
  })
  async getInventory(@Query() query: QueryInventoryDto) {
    return this.inventoryService.findInventory(query);
  }
}
