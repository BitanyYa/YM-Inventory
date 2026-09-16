import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { SalespeopleService } from './salespeople.service';
import { CreateSalespersonDto } from './dto/create-salesperson.dto';
import { UpdateSalespersonDto } from './dto/update-salesperson.dto';
import { QuerySalespersonDto } from './dto/query-salesperson.dto';

@ApiTags('salespeople')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('salespeople')
export class SalespeopleController {
  constructor(private readonly salespeopleService: SalespeopleService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new salesperson (Admin only)' })
  @ApiResponse({ status: 201, description: 'Salesperson created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 403, description: 'Forbidden for non-admin users' })
  async create(@Body() dto: CreateSalespersonDto) {
    return this.salespeopleService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Get salespeople (active by default, optional search)' })
  @ApiResponse({ status: 200, description: 'List of salespeople' })
  async findAll(@Query() query: QuerySalespersonDto) {
    return this.salespeopleService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Get a single salesperson by ID' })
  @ApiParam({ name: 'id', description: 'Salesperson UUID' })
  @ApiResponse({ status: 200, description: 'Salesperson details' })
  @ApiResponse({ status: 404, description: 'Salesperson not found' })
  async findOne(@Param('id') id: string) {
    return this.salespeopleService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a salesperson (Admin only)' })
  @ApiParam({ name: 'id', description: 'Salesperson UUID' })
  @ApiResponse({ status: 200, description: 'Salesperson updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 403, description: 'Forbidden for non-admin users' })
  @ApiResponse({ status: 404, description: 'Salesperson not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSalespersonDto,
  ) {
    return this.salespeopleService.update(id, dto);
  }
}
