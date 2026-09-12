import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { ConsentsService } from './consents.service';

describe('ConsentsService', () => {
  let service: ConsentsService;

  const mockPrismaService = {
    pet: { findFirst: jest.fn() },
    clinic: { findFirst: jest.fn() },
    tutor: { findUnique: jest.fn() },
    tutorPet: { findUnique: jest.fn() },
    clinicPetConsent: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsentsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ConsentsService>(ConsentsService);
    jest.clearAllMocks();

    mockPrismaService.pet.findFirst.mockResolvedValue({ id: 'pet-1' });
    mockPrismaService.tutor.findUnique.mockResolvedValue({ id: 'tutor-1' });
    mockPrismaService.tutorPet.findUnique.mockResolvedValue({
      tutorId: 'tutor-1',
      petId: 'pet-1',
    });
  });

  describe('grant', () => {
    const dto = { clinicId: 'clinic-1' };

    it('lança NotFoundException se o pet não existir', async () => {
      mockPrismaService.pet.findFirst.mockResolvedValue(null);

      await expect(service.grant('user-1', 'pet-1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lança ForbiddenException se o usuário não for tutor vinculado ao pet', async () => {
      mockPrismaService.tutorPet.findUnique.mockResolvedValue(null);

      await expect(service.grant('user-1', 'pet-1', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lança NotFoundException se a clínica não existir', async () => {
      mockPrismaService.clinic.findFirst.mockResolvedValue(null);

      await expect(service.grant('user-1', 'pet-1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lança ConflictException se já houver consentimento ativo para a clínica', async () => {
      mockPrismaService.clinic.findFirst.mockResolvedValue({ id: 'clinic-1' });
      mockPrismaService.clinicPetConsent.findFirst.mockResolvedValue({
        id: 'consent-1',
      });

      await expect(service.grant('user-1', 'pet-1', dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('cria o consentimento vinculado ao tutor autenticado', async () => {
      mockPrismaService.clinic.findFirst.mockResolvedValue({ id: 'clinic-1' });
      mockPrismaService.clinicPetConsent.findFirst.mockResolvedValue(null);
      mockPrismaService.clinicPetConsent.create.mockResolvedValue({
        id: 'consent-1',
      });

      const result = await service.grant('user-1', 'pet-1', dto);

      expect(result).toEqual({ id: 'consent-1' });
      expect(mockPrismaService.clinicPetConsent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { clinicId: 'clinic-1', petId: 'pet-1', tutorId: 'tutor-1' },
        }) as unknown,
      );
    });
  });

  describe('findAllForPet', () => {
    it('permite platform_admin sem vínculo de tutor', async () => {
      mockPrismaService.tutorPet.findUnique.mockResolvedValue(null);
      mockPrismaService.clinicPetConsent.findMany.mockResolvedValue([]);

      await expect(
        service.findAllForPet('admin-1', UserRole.platform_admin, 'pet-1'),
      ).resolves.toEqual([]);
    });

    it('lança ForbiddenException para tutor sem vínculo ao pet', async () => {
      mockPrismaService.tutorPet.findUnique.mockResolvedValue(null);

      await expect(
        service.findAllForPet('user-1', UserRole.tutor, 'pet-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('revoke', () => {
    it('lança NotFoundException se não houver consentimento ativo para a clínica', async () => {
      mockPrismaService.clinicPetConsent.findFirst.mockResolvedValue(null);

      await expect(
        service.revoke('user-1', 'pet-1', 'clinic-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('marca o consentimento como revogado', async () => {
      mockPrismaService.clinicPetConsent.findFirst.mockResolvedValue({
        id: 'consent-1',
      });
      mockPrismaService.clinicPetConsent.update.mockResolvedValue({
        id: 'consent-1',
        revokedAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      const result = await service.revoke('user-1', 'pet-1', 'clinic-1');

      expect(result).toEqual({
        id: 'consent-1',
        revokedAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      expect(mockPrismaService.clinicPetConsent.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'consent-1' } }) as unknown,
      );
    });
  });
});
