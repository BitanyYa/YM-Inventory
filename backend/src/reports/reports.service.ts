import { Injectable } from '@nestjs/common';
import { MovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryStockReportDto } from './dto/query-stock-report.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStockMovementsReport(query: QueryStockReportDto) {
    let parsedStart: Date | null = null;
    if (query.startDate) {
      parsedStart = new Date(query.startDate);
    }

    let parsedEnd: Date | null = null;
    if (query.endDate) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(query.endDate.trim())) {
        parsedEnd = new Date(`${query.endDate.trim()}T23:59:59.999Z`);
      } else {
        parsedEnd = new Date(query.endDate);
        if (
          !query.endDate.includes('T') &&
          parsedEnd.getHours() === 0 &&
          parsedEnd.getMinutes() === 0 &&
          parsedEnd.getSeconds() === 0
        ) {
          parsedEnd.setHours(23, 59, 59, 999);
        }
      }
    }

    const where: Prisma.StockMovementWhereInput = {};

    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.movementType) {
      where.movementType = query.movementType;
    }
    if (query.fromLocation) {
      where.fromLocation = query.fromLocation;
    }
    if (query.toLocation) {
      where.toLocation = query.toLocation;
    }
    if (parsedStart || parsedEnd) {
      where.createdAt = {};
      if (parsedStart) {
        where.createdAt.gte = parsedStart;
      }
      if (parsedEnd) {
        where.createdAt.lte = parsedEnd;
      }
    }

    const movements = await this.prisma.stockMovement.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const allMovementTypes = Object.values(MovementType);

    const initMovementMap = () => {
      const map: Record<string, number> = {};
      for (const type of allMovementTypes) {
        map[type] = 0;
      }
      return map;
    };

    const overallTotals = initMovementMap();
    let totalMovements = 0;
    let totalQuantity = 0;

    const productMap = new Map<
      string,
      {
        productId: string;
        productName: string;
        movementTotals: Record<string, number>;
        totalMovements: number;
        totalQuantity: number;
      }
    >();

    for (const movement of movements) {
      const type = movement.movementType;
      const qty = movement.quantity;

      overallTotals[type] = (overallTotals[type] || 0) + qty;
      totalMovements += 1;
      totalQuantity += qty;

      let pData = productMap.get(movement.productId);
      if (!pData) {
        pData = {
          productId: movement.productId,
          productName: movement.product?.name || 'Unknown Product',
          movementTotals: initMovementMap(),
          totalMovements: 0,
          totalQuantity: 0,
        };
        productMap.set(movement.productId, pData);
      }

      pData.movementTotals[type] = (pData.movementTotals[type] || 0) + qty;
      pData.totalMovements += 1;
      pData.totalQuantity += qty;
    }

    return {
      period: {
        startDate: parsedStart ? parsedStart.toISOString() : null,
        endDate: parsedEnd ? parsedEnd.toISOString() : null,
      },
      summary: {
        movementTotals: overallTotals,
        totalMovements,
        totalQuantity,
      },
      byProduct: Array.from(productMap.values()).sort((a, b) =>
        a.productName.localeCompare(b.productName),
      ),
    };
  }
}
