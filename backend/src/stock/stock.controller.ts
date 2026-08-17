import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { StockService } from './stock.service';
import { ReceiveStockDto } from './dto/receive-stock.dto';
import { TransferStockDto } from './dto/transfer-stock.dto';
import { SellStockDto } from './dto/sell-stock.dto';
import { ReturnStockDto } from './dto/return-stock.dto';
import { QueryStockMovementDto } from './dto/query-stock-movement.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { QueryStockTransferDto } from './dto/query-stock-transfer.dto';

@ApiTags('stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('movements')
  @ApiOperation({
    summary:
      'Get paginated stock movement history with optional filters (page, limit, productId, movementType, fromLocation, toLocation, startDate, endDate)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of stock movements ordered newest first with metadata',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error (e.g. page < 1, limit < 1, or limit > 100)',
  })
  async getMovements(@Query() query: QueryStockMovementDto) {
    return this.stockService.findMovements(query);
  }

  @Get('transfers')
  @ApiOperation({
    summary:
      'Get paginated stock transfer history with optional filters (page, limit, productId, fromLocation, toLocation, startDate, endDate)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of stock transfers ordered newest first with metadata',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error (e.g. page < 1, limit < 1, or limit > 100 or startDate > endDate)',
  })
  async getTransfers(@Query() query: QueryStockTransferDto) {
    return this.stockService.findTransfers(query);
  }

  @Get('movements/:id')
  @ApiOperation({
    summary: 'Get detailed stock movement information by ID',
  })
  @ApiParam({ name: 'id', description: 'Stock Movement UUID' })
  @ApiResponse({
    status: 200,
    description:
      'Stock movement details with product, creator, batch, and associated units',
  })
  @ApiResponse({ status: 404, description: 'Stock movement not found' })
  async findMovementById(@Param('id') id: string) {
    return this.stockService.findMovementById(id);
  }

  @Post('receive')
  @ApiOperation({
    summary: 'Receive stock (stock in) for QUANTITY or SERIALIZED products into Warehouse',
  })
  @ApiResponse({
    status: 201,
    description: 'Stock successfully received into warehouse',
  })
  @ApiResponse({ status: 400, description: 'Validation or logic error' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 409, description: 'Batch reference or IMEI duplicate conflict' })
  async receiveStock(
    @Body() dto: ReceiveStockDto,
    @GetUser('id') userId: string,
  ) {
    return this.stockService.receiveStock(dto, userId);
  }

  @Post('transfer')
  @ApiOperation({
    summary: 'Transfer stock from Warehouse to Shop for QUANTITY or SERIALIZED products',
  })
  @ApiResponse({
    status: 201,
    description: 'Stock successfully transferred from Warehouse to Shop',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error, insufficient warehouse stock, or invalid unit status/location',
  })
  @ApiResponse({ status: 404, description: 'Product or ProductUnit not found' })
  async transferStock(
    @Body() dto: TransferStockDto,
    @GetUser('id') userId: string,
  ) {
    return this.stockService.transferStock(dto, userId);
  }

  @Post('sell')
  @ApiOperation({
    summary: 'Sell stock from Shop for QUANTITY or SERIALIZED products',
  })
  @ApiResponse({
    status: 201,
    description: 'Stock successfully sold from Shop',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error, insufficient shop stock, or invalid unit status/location',
  })
  @ApiResponse({ status: 404, description: 'Product or ProductUnit not found' })
  async sellStock(
    @Body() dto: SellStockDto,
    @GetUser('id') userId: string,
  ) {
    return this.stockService.sellStock(dto, userId);
  }

  @Post('return')
  @ApiOperation({
    summary: 'Return sold stock to Warehouse or Shop for QUANTITY or SERIALIZED products',
  })
  @ApiResponse({
    status: 201,
    description: 'Stock successfully returned to destination location',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error, invalid destination location, inactive product, or invalid unit status (must be SOLD)',
  })
  @ApiResponse({ status: 404, description: 'Product or ProductUnit not found' })
  async returnStock(
    @Body() dto: ReturnStockDto,
    @GetUser('id') userId: string,
  ) {
    return this.stockService.returnStock(dto, userId);
  }

  @Post('adjust')
  @ApiOperation({
    summary: 'Adjust stock for DAMAGE or LOSS (QUANTITY or SERIALIZED products)',
  })
  @ApiResponse({
    status: 201,
    description: 'Stock successfully adjusted for DAMAGE or LOSS',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error, invalid movement type, or insufficient stock / invalid unit status',
  })
  @ApiResponse({ status: 404, description: 'Product or ProductUnit not found' })
  async adjustStock(
    @Body() dto: AdjustStockDto,
    @GetUser('id') userId: string,
  ) {
    return this.stockService.adjustStock(dto, userId);
  }
}
