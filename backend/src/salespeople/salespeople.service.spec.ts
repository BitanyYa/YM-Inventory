import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import { SalespeopleService } from './salespeople.service';
import { SalespeopleController } from './salespeople.controller';
import { PrismaService } from '../prisma/prisma.service';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('SalespeopleService Unit Tests', () => {
  let service: SalespeopleService;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  const mockSalespersonAbel = {
    id: 'sp-abel-id',
    name: 'Abel Tesfaye',
    phone: '0911000000',
    isActive: true,
    createdAt: new Date('2026-09-15T10:00:00Z'),
    updatedAt: new Date('2026-09-15T10:00:00Z'),
  };

  const mockSalespersonHana = {
    id: 'sp-hana-id',
    name: 'Hana Kebede',
    phone: null,
    isActive: true,
    createdAt: new Date('2026-09-15T11:00:00Z'),
    updatedAt: new Date('2026-09-15T11:00:00Z'),
  };

  const mockInactiveSalesperson = {
    id: 'sp-inactive-id',
    name: 'Inactive Person',
    phone: '0933000000',
    isActive: false,
    createdAt: new Date('2026-09-15T12:00:00Z'),
    updatedAt: new Date('2026-09-15T12:00:00Z'),
  };

  const mockPrismaService = {
    salesperson: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalespeopleService,
        { provide: PrismaService, useValue: mockPrismaService },
        Reflector,
      ],
    }).compile();

    service = module.get<SalespeopleService>(SalespeopleService);
    reflector = module.get<Reflector>(Reflector);
    rolesGuard = new RolesGuard(reflector);
  });

  describe('1. Create Salesperson', () => {
    it('should allow creating a salesperson with required name and optional phone', async () => {
      mockPrismaService.salesperson.create.mockResolvedValue(mockSalespersonAbel);

      const result = await service.create({
        name: 'Abel Tesfaye',
        phone: '0911000000',
      });

      expect(result).toEqual(mockSalespersonAbel);
      expect(mockPrismaService.salesperson.create).toHaveBeenCalledWith({
        data: {
          name: 'Abel Tesfaye',
          phone: '0911000000',
        },
      });
    });

    it('should create a salesperson when phone is omitted/null', async () => {
      mockPrismaService.salesperson.create.mockResolvedValue(mockSalespersonHana);

      const result = await service.create({
        name: 'Hana Kebede',
      });

      expect(result).toEqual(mockSalespersonHana);
      expect(mockPrismaService.salesperson.create).toHaveBeenCalledWith({
        data: {
          name: 'Hana Kebede',
          phone: null,
        },
      });
    });

    it('should throw BadRequestException if name is empty or only whitespace', async () => {
      await expect(service.create({ name: '   ' })).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.salesperson.create).not.toHaveBeenCalled();
    });
  });

  describe('2. GET Active Salespeople & Search', () => {
    it('should return active salespeople by default', async () => {
      mockPrismaService.salesperson.findMany.mockResolvedValue([
        mockSalespersonAbel,
        mockSalespersonHana,
      ]);

      const result = await service.findAll();

      expect(result).toEqual([mockSalespersonAbel, mockSalespersonHana]);
      expect(mockPrismaService.salesperson.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
    });

    it('should exclude inactive salespeople from default list', async () => {
      mockPrismaService.salesperson.findMany.mockResolvedValue([
        mockSalespersonAbel,
      ]);

      await service.findAll({});

      expect(mockPrismaService.salesperson.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
    });

    it('should support search by name (case-insensitive)', async () => {
      mockPrismaService.salesperson.findMany.mockResolvedValue([
        mockSalespersonAbel,
      ]);

      await service.findAll({ search: 'abel' });

      expect(mockPrismaService.salesperson.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          OR: [
            { name: { contains: 'abel', mode: 'insensitive' } },
            { phone: { contains: 'abel', mode: 'insensitive' } },
          ],
        },
        orderBy: { name: 'asc' },
      });
    });

    it('should allow including inactive salespeople when includeInactive is true', async () => {
      mockPrismaService.salesperson.findMany.mockResolvedValue([
        mockSalespersonAbel,
        mockInactiveSalesperson,
      ]);

      await service.findAll({ includeInactive: true });

      expect(mockPrismaService.salesperson.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('3. GET Salesperson by ID', () => {
    it('should return a salesperson by ID (active or inactive)', async () => {
      mockPrismaService.salesperson.findUnique.mockResolvedValue(
        mockInactiveSalesperson,
      );

      const result = await service.findOne(mockInactiveSalesperson.id);

      expect(result).toEqual(mockInactiveSalesperson);
      expect(mockPrismaService.salesperson.findUnique).toHaveBeenCalledWith({
        where: { id: mockInactiveSalesperson.id },
      });
    });

    it('should throw NotFoundException if salesperson does not exist', async () => {
      mockPrismaService.salesperson.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('4. PATCH Salesperson & Deactivation', () => {
    it('should allow updating salesperson details by ID', async () => {
      mockPrismaService.salesperson.findUnique.mockResolvedValue(
        mockSalespersonAbel,
      );
      mockPrismaService.salesperson.update.mockResolvedValue({
        ...mockSalespersonAbel,
        name: 'Abel T.',
        phone: '0999999999',
      });

      const result = await service.update(mockSalespersonAbel.id, {
        name: 'Abel T.',
        phone: '0999999999',
      });

      expect(result.name).toBe('Abel T.');
      expect(result.phone).toBe('0999999999');
      expect(mockPrismaService.salesperson.update).toHaveBeenCalledWith({
        where: { id: mockSalespersonAbel.id },
        data: { name: 'Abel T.', phone: '0999999999' },
      });
    });

    it('should set isActive=false when deactivating a salesperson', async () => {
      mockPrismaService.salesperson.findUnique.mockResolvedValue(
        mockSalespersonAbel,
      );
      mockPrismaService.salesperson.update.mockResolvedValue({
        ...mockSalespersonAbel,
        isActive: false,
      });

      const result = await service.update(mockSalespersonAbel.id, {
        isActive: false,
      });

      expect(result.isActive).toBe(false);
      expect(mockPrismaService.salesperson.update).toHaveBeenCalledWith({
        where: { id: mockSalespersonAbel.id },
        data: { isActive: false },
      });
    });

    it('should throw BadRequestException if update attempts to clear name to empty string', async () => {
      mockPrismaService.salesperson.findUnique.mockResolvedValue(
        mockSalespersonAbel,
      );

      await expect(
        service.update(mockSalespersonAbel.id, { name: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when patching a nonexistent salesperson', async () => {
      mockPrismaService.salesperson.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent-id', { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('5. Authorization & RolesGuard', () => {
    it('should allow ADMIN users for POST (create) and PATCH (update)', () => {
      const mockContext: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: UserRole.ADMIN },
          }),
        }),
      };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
      expect(rolesGuard.canActivate(mockContext)).toBe(true);
    });

    it('should deny USER role for POST/PATCH endpoints requiring ADMIN', () => {
      const mockContext: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: UserRole.USER },
          }),
        }),
      };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
      expect(() => rolesGuard.canActivate(mockContext)).toThrow(
        ForbiddenException,
      );
    });

    it('should allow both ADMIN and USER for GET endpoints', () => {
      const mockAdminContext: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: UserRole.ADMIN },
          }),
        }),
      };
      const mockUserContext: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: UserRole.USER },
          }),
        }),
      };

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([UserRole.ADMIN, UserRole.USER]);

      expect(rolesGuard.canActivate(mockAdminContext)).toBe(true);
      expect(rolesGuard.canActivate(mockUserContext)).toBe(true);
    });
  });
});
