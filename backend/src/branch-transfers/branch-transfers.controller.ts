import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { BranchTransfersService } from './branch-transfers.service';
import { CreateBranchTransferDto } from './dto/create-branch-transfer.dto';
import { QueryBranchInventoryDto } from './dto/query-branch-inventory.dto';
import { QueryBranchTransferDto } from './dto/query-branch-transfer.dto';

@ApiTags('branch-transfers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('branch-transfers')
export class BranchTransfersController {
  constructor(
    private readonly branchTransfersService: BranchTransfersService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Transfer product stock from Main Shop to a Branch (ADMIN only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Stock transferred to branch successfully',
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation error (insufficient shop stock, inactive branch/product, serialized product, non-positive quantity)',
  })
  @ApiResponse({
    status: 404,
    description: 'Branch or product not found',
  })
  async createTransfer(
    @Body() dto: CreateBranchTransferDto,
    @GetUser('id') userId: string,
  ) {
    return this.branchTransfersService.transferToBranch(dto, userId);
  }

  @Get('branches')
  @Roles(UserRole.ADMIN, UserRole.USER)
  @ApiOperation({
    summary: 'Get active branches',
  })
  @ApiResponse({
    status: 200,
    description: 'Active branches retrieved successfully',
  })
  async getBranches() {
    return this.branchTransfersService.getBranches();
  }

  @Get('inventory')
  @Roles(UserRole.ADMIN, UserRole.USER)
  @ApiOperation({
    summary: 'Get current stock balance across branches',
  })
  @ApiResponse({
    status: 200,
    description: 'Current branch stock balances retrieved successfully',
  })
  async getBranchInventory(@Query() query: QueryBranchInventoryDto) {
    return this.branchTransfersService.getBranchInventory(query);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.USER)
  @ApiOperation({
    summary: 'Get paginated history of branch transfer events',
  })
  @ApiResponse({
    status: 200,
    description: 'Branch transfer history retrieved successfully',
  })
  async getBranchTransfers(@Query() query: QueryBranchTransferDto) {
    return this.branchTransfersService.getBranchTransfers(query);
  }
}
