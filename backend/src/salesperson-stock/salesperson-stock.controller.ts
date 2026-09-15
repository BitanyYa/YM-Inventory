import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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
import { SalespersonStockService } from './salesperson-stock.service';
import { AllocateProductDto } from './dto/allocate-product.dto';
import { QuerySalespersonStockDto } from './dto/query-salesperson-stock.dto';
import { QueryProductAllocationDto } from './dto/query-product-allocation.dto';

@ApiTags('salesperson-stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('salesperson-stock')
export class SalespersonStockController {
  constructor(
    private readonly salespersonStockService: SalespersonStockService,
  ) {}

  @Post('allocate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Allocate stock from SHOP to a salesperson (ADMIN only, allocation-enabled categories only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Stock allocated to salesperson successfully',
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation error (insufficient shop stock, allocation disabled for category, serialized product, etc.)',
  })
  @ApiResponse({
    status: 404,
    description: 'Product or salesperson user not found',
  })
  async allocateProduct(
    @Body() dto: AllocateProductDto,
    @GetUser('id') userId: string,
  ) {
    return this.salespersonStockService.allocateProduct(dto, userId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.USER)
  @ApiOperation({
    summary: 'Get current stock balances allocated to salespeople',
  })
  @ApiResponse({
    status: 200,
    description: 'Current salesperson stock balances retrieved successfully',
  })
  async findAllStock(@Query() query: QuerySalespersonStockDto) {
    return this.salespersonStockService.findAllStock(query);
  }

  @Get('allocations')
  @Roles(UserRole.ADMIN, UserRole.USER)
  @ApiOperation({
    summary: 'Get paginated history of product allocation events',
  })
  @ApiResponse({
    status: 200,
    description: 'Allocation history records retrieved successfully',
  })
  async findAllAllocations(@Query() query: QueryProductAllocationDto) {
    return this.salespersonStockService.findAllAllocations(query);
  }

  @Get(':salespersonId')
  @Roles(UserRole.ADMIN, UserRole.USER)
  @ApiOperation({
    summary: 'Get current stock balances for a specific salesperson',
  })
  @ApiParam({
    name: 'salespersonId',
    description: 'User ID of the salesperson',
  })
  @ApiResponse({
    status: 200,
    description: 'Salesperson stock balances retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Salesperson user not found',
  })
  async findStockBySalesperson(
    @Param('salespersonId') salespersonId: string,
  ) {
    return this.salespersonStockService.findStockBySalesperson(salespersonId);
  }
}
