import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PetStatus, PrescriptionStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { PrescriptionsService } from './prescriptions.service';

describe('PrescriptionsService', () => {
  let service: PrescriptionsService;

  const mockPrismaService = {
    veterinarian: { findUnique: jest.fn() },
    clinicVeterinarian: { findUnique: jest.fn() },
    pet: { findFirst: jest.fn() },
    vaccine: { findUnique: jest.fn() },
    clinicPetConsent: { findFirst: jest.fn() },
    prescription: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrescriptionsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PrescriptionsService>(PrescriptionsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto = {
      petId: 'pet-1',
      clinicId: 'clinic-1',
      vaccineId: 'vaccine-1',
    };

    it('lança ForbiddenException se o usuário não for veterinário', async () => {
      mockPrismaService.veterinarian.findUnique.mockResolvedValue(null);

      await expect(service.create('user-1', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lança ForbiddenException se o veterinário não estiver vinculado à clínica', async () => {
      mockPrismaService.veterinarian.findUnique.mockResolvedValue({
        id: 'vet-1',
      });
      mockPrismaService.clinicVeterinarian.findUnique.mockResolvedValue(null);

      await expect(service.create('user-1', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lança NotFoundException se o pet não existir', async () => {
      mockPrismaService.veterinarian.findUnique.mockResolvedValue({
        id: 'vet-1',
      });
      mockPrismaService.clinicVeterinarian.findUnique.mockResolvedValue({
        isActive: true,
      });
      mockPrismaService.pet.findFirst.mockResolvedValue(null);

      await expect(service.create('user-1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lança UnprocessableEntityException se o pet estiver arquivado', async () => {
      mockPrismaService.veterinarian.findUnique.mockResolvedValue({
        id: 'vet-1',
      });
      mockPrismaService.clinicVeterinarian.findUnique.mockResolvedValue({
        isActive: true,
      });
      mockPrismaService.pet.findFirst.mockResolvedValue({
        id: 'pet-1',
        status: PetStatus.archived,
      });

      await expect(service.create('user-1', dto)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('lança NotFoundException se a vacina não existir ou estiver inativa', async () => {
      mockPrismaService.veterinarian.findUnique.mockResolvedValue({
        id: 'vet-1',
      });
      mockPrismaService.clinicVeterinarian.findUnique.mockResolvedValue({
        isActive: true,
      });
      mockPrismaService.pet.findFirst.mockResolvedValue({
        id: 'pet-1',
        status: PetStatus.active,
      });
      mockPrismaService.vaccine.findUnique.mockResolvedValue({
        id: 'vaccine-1',
        isActive: false,
      });

      await expect(service.create('user-1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lança ForbiddenException se o tutor não autorizou a clínica (sem consentimento)', async () => {
      mockPrismaService.veterinarian.findUnique.mockResolvedValue({
        id: 'vet-1',
      });
      mockPrismaService.clinicVeterinarian.findUnique.mockResolvedValue({
        isActive: true,
      });
      mockPrismaService.pet.findFirst.mockResolvedValue({
        id: 'pet-1',
        status: PetStatus.active,
      });
      mockPrismaService.vaccine.findUnique.mockResolvedValue({
        id: 'vaccine-1',
        isActive: true,
      });
      mockPrismaService.clinicPetConsent.findFirst.mockResolvedValue(null);

      await expect(service.create('user-1', dto)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrismaService.prescription.create).not.toHaveBeenCalled();
    });

    it('cria a prescrição com dose padrão 1', async () => {
      mockPrismaService.veterinarian.findUnique.mockResolvedValue({
        id: 'vet-1',
      });
      mockPrismaService.clinicVeterinarian.findUnique.mockResolvedValue({
        isActive: true,
      });
      mockPrismaService.pet.findFirst.mockResolvedValue({
        id: 'pet-1',
        status: PetStatus.active,
      });
      mockPrismaService.vaccine.findUnique.mockResolvedValue({
        id: 'vaccine-1',
        isActive: true,
      });
      mockPrismaService.clinicPetConsent.findFirst.mockResolvedValue({
        id: 'consent-1',
      });
      mockPrismaService.prescription.create.mockResolvedValue({
        id: 'prescription-1',
      });

      const result = await service.create('user-1', dto);

      expect(result).toEqual({ id: 'prescription-1' });
      expect(mockPrismaService.prescription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            veterinarianId: 'vet-1',
            doseNumber: 1,
            scheduledAt: null,
          }) as unknown,
        }),
      );
    });
  });

  describe('updateStatus', () => {
    it('lança NotFoundException se a prescrição não existir', async () => {
      mockPrismaService.prescription.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus('user-1', UserRole.veterinarian, 'p-1', {
          status: PrescriptionStatus.cancelled,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('bloqueia veterinário de outra clínica', async () => {
      mockPrismaService.prescription.findUnique.mockResolvedValue({
        id: 'p-1',
        veterinarianId: 'vet-owner',
        clinicId: 'clinic-1',
      });
      mockPrismaService.veterinarian.findUnique.mockResolvedValue({
        id: 'vet-2',
      });
      mockPrismaService.clinicVeterinarian.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus('user-2', UserRole.veterinarian, 'p-1', {
          status: PrescriptionStatus.cancelled,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejeita tentativa de definir status "applied" manualmente', async () => {
      mockPrismaService.prescription.findUnique.mockResolvedValue({
        id: 'p-1',
        veterinarianId: 'vet-owner',
        clinicId: 'clinic-1',
      });
      mockPrismaService.veterinarian.findUnique.mockResolvedValue({
        id: 'vet-owner',
      });

      await expect(
        service.updateStatus('user-1', UserRole.veterinarian, 'p-1', {
          status: PrescriptionStatus.applied,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.prescription.update).not.toHaveBeenCalled();
    });

    it('permite o veterinário autor cancelar', async () => {
      mockPrismaService.prescription.findUnique.mockResolvedValue({
        id: 'p-1',
        veterinarianId: 'vet-owner',
        clinicId: 'clinic-1',
      });
      mockPrismaService.veterinarian.findUnique.mockResolvedValue({
        id: 'vet-owner',
      });
      mockPrismaService.prescription.update.mockResolvedValue({
        id: 'p-1',
        status: PrescriptionStatus.cancelled,
      });

      const result = await service.updateStatus(
        'user-1',
        UserRole.veterinarian,
        'p-1',
        { status: PrescriptionStatus.cancelled, notes: 'Tutor desistiu' },
      );

      expect(result).toEqual({
        id: 'p-1',
        status: PrescriptionStatus.cancelled,
      });
    });
  });
});
