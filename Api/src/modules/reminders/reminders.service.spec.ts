import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { RemindersService } from './reminders.service';

describe('RemindersService', () => {
  let service: RemindersService;

  const mockPrismaService = {
    pet: { findFirst: jest.fn() },
    tutor: { findUnique: jest.fn() },
    tutorPet: { findUnique: jest.fn() },
    vaccinationReminder: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemindersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<RemindersService>(RemindersService);
    jest.clearAllMocks();

    mockPrismaService.pet.findFirst.mockResolvedValue({ id: 'pet-1' });
    mockPrismaService.tutor.findUnique.mockResolvedValue({ id: 'tutor-1' });
    mockPrismaService.tutorPet.findUnique.mockResolvedValue({
      tutorId: 'tutor-1',
      petId: 'pet-1',
    });
  });

  describe('findAllForPet', () => {
    it('lança NotFoundException se o pet não existir', async () => {
      mockPrismaService.pet.findFirst.mockResolvedValue(null);

      await expect(
        service.findAllForPet('user-1', UserRole.tutor, 'pet-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança ForbiddenException para tutor sem vínculo ao pet', async () => {
      mockPrismaService.tutorPet.findUnique.mockResolvedValue(null);

      await expect(
        service.findAllForPet('user-1', UserRole.tutor, 'pet-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permite platform_admin sem vínculo de tutor', async () => {
      mockPrismaService.tutorPet.findUnique.mockResolvedValue(null);
      mockPrismaService.vaccinationReminder.findMany.mockResolvedValue([]);

      await expect(
        service.findAllForPet('admin-1', UserRole.platform_admin, 'pet-1'),
      ).resolves.toEqual([]);
    });

    it('lista os lembretes do pet ordenados por remindAt', async () => {
      mockPrismaService.vaccinationReminder.findMany.mockResolvedValue([
        { id: 'reminder-1', remindAt: new Date('2026-02-01') },
      ]);

      const result = await service.findAllForPet(
        'user-1',
        UserRole.tutor,
        'pet-1',
      );

      expect(result).toEqual([
        { id: 'reminder-1', remindAt: new Date('2026-02-01') },
      ]);
      expect(
        mockPrismaService.vaccinationReminder.findMany,
      ).toHaveBeenCalledWith({
        where: { petId: 'pet-1' },
        include: { vaccine: true },
        orderBy: { remindAt: 'asc' },
      });
    });
  });
});
