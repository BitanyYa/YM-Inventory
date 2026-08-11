import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
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

@ApiTags('stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

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
    summary: 'Return stock from Shop back to Warehouse for QUANTITY or SERIALIZED products',
  })
  @ApiResponse({
    status: 201,
    description: 'Stock successfully returned to Warehouse',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error or invalid unit status (must be SOLD in SHOP)',
  })
  @ApiResponse({ status: 404, description: 'Product or ProductUnit not found' })
  async returnStock(
    @Body() dto: ReturnStockDto,
    @GetUser('id') userId: string,
  ) {
    return this.stockService.returnStock(dto, userId);
  }
}
