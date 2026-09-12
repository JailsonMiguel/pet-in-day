import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  PetStatus,
  PrescriptionStatus,
  VaccinationStatus,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { VaccinationsService } from './vaccinations.service';

type TxCallback = (tx: unknown) => unknown;

describe('VaccinationsService', () => {
  let service: VaccinationsService;

  const mockPrismaService = {
    veterinarian: { findUnique: jest.fn() },
    clinicVeterinarian: { findUnique: jest.fn() },
    pet: { findFirst: jest.fn() },
    vaccine: { findUnique: jest.fn() },
    prescription: { findUnique: jest.fn() },
    vaccineProtocol: { findUnique: jest.fn() },
    vaccination: { findUnique: jest.fn() },
    clinicPetConsent: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };

  const baseDto = {
    petId: 'pet-1',
    clinicId: 'clinic-1',
    vaccineId: 'vaccine-1',
    doseNumber: 1,
    batchNumber: 'LOT1',
    batchExpiry: '2027-01-01',
    appliedAt: '2026-01-01T10:00:00.000Z',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VaccinationsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<VaccinationsService>(VaccinationsService);
    jest.clearAllMocks();

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
    mockPrismaService.vaccine.findUnique.mockResolvedValue({ id: 'vaccine-1' });
    mockPrismaService.vaccineProtocol.findUnique.mockResolvedValue(null);
    mockPrismaService.clinicPetConsent.findFirst.mockResolvedValue({
      id: 'consent-1',
    });
    mockPrismaService.$transaction.mockImplementation((cb: TxCallback) =>
      cb({
        vaccination: {
          create: jest.fn().mockResolvedValue({ id: 'vaccination-1' }),
        },
        prescription: { update: jest.fn() },
      }),
    );
  });

  describe('create', () => {
    it('lança ForbiddenException se o tutor não autorizou a clínica (sem consentimento)', async () => {
      mockPrismaService.clinicPetConsent.findFirst.mockResolvedValue(null);

      await expect(service.create('user-1', baseDto)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('lança BadRequestException se a validade do lote for anterior à aplicação', async () => {
      await expect(
        service.create('user-1', {
          ...baseDto,
          batchExpiry: '2025-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança NotFoundException se o pet não existir', async () => {
      mockPrismaService.pet.findFirst.mockResolvedValue(null);

      await expect(service.create('user-1', baseDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lança NotFoundException se a prescrição informada não existir', async () => {
      mockPrismaService.prescription.findUnique.mockResolvedValue(null);

      await expect(
        service.create('user-1', { ...baseDto, prescriptionId: 'p-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança BadRequestException se a prescrição não corresponder ao pet/vacina', async () => {
      mockPrismaService.prescription.findUnique.mockResolvedValue({
        id: 'p-1',
        petId: 'outro-pet',
        vaccineId: 'vaccine-1',
        doseNumber: 1,
        status: PrescriptionStatus.pending,
      });

      await expect(
        service.create('user-1', { ...baseDto, prescriptionId: 'p-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança ConflictException se a prescrição já foi aplicada', async () => {
      mockPrismaService.prescription.findUnique.mockResolvedValue({
        id: 'p-1',
        petId: 'pet-1',
        vaccineId: 'vaccine-1',
        doseNumber: 1,
        status: PrescriptionStatus.applied,
      });

      await expect(
        service.create('user-1', { ...baseDto, prescriptionId: 'p-1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('calcula nextDoseAt a partir do próximo protocolo da vacina', async () => {
      mockPrismaService.vaccineProtocol.findUnique.mockResolvedValue({
        doseNumber: 2,
        intervalDays: 21,
      });
      const createSpy = jest.fn().mockResolvedValue({ id: 'vaccination-1' });
      mockPrismaService.$transaction.mockImplementation((cb: TxCallback) =>
        cb({
          vaccination: { create: createSpy },
          prescription: { update: jest.fn() },
        }),
      );

      await service.create('user-1', baseDto);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nextDoseAt: new Date('2026-01-22T10:00:00.000Z'),
          }) as unknown,
        }),
      );
    });

    it('nextDoseAt é null quando não há próxima dose no protocolo', async () => {
      const createSpy = jest.fn().mockResolvedValue({ id: 'vaccination-1' });
      mockPrismaService.$transaction.mockImplementation((cb: TxCallback) =>
        cb({
          vaccination: { create: createSpy },
          prescription: { update: jest.fn() },
        }),
      );

      await service.create('user-1', baseDto);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ nextDoseAt: null }) as unknown,
        }),
      );
    });

    it('marca a prescrição vinculada como aplicada', async () => {
      mockPrismaService.prescription.findUnique.mockResolvedValue({
        id: 'p-1',
        petId: 'pet-1',
        vaccineId: 'vaccine-1',
        doseNumber: 1,
        status: PrescriptionStatus.pending,
      });
      const prescriptionUpdate = jest.fn();
      mockPrismaService.$transaction.mockImplementation((cb: TxCallback) =>
        cb({
          vaccination: {
            create: jest.fn().mockResolvedValue({ id: 'vaccination-1' }),
          },
          prescription: { update: prescriptionUpdate },
        }),
      );

      await service.create('user-1', { ...baseDto, prescriptionId: 'p-1' });

      expect(prescriptionUpdate).toHaveBeenCalledWith({
        where: { id: 'p-1' },
        data: { status: PrescriptionStatus.applied },
      });
    });
  });

  describe('rectify', () => {
    const existingVaccination = {
      id: 'vaccination-1',
      veterinarianId: 'vet-1',
      clinicId: 'clinic-1',
      batchNumber: 'LOT1',
      batchExpiry: new Date('2027-01-01T00:00:00.000Z'),
      applicationSite: 'nuca',
      notes: null,
    };

    it('lança NotFoundException se a vacinação não existir', async () => {
      mockPrismaService.vaccination.findUnique.mockResolvedValue(null);

      await expect(
        service.rectify('user-1', 'veterinarian', 'v-1', {
          reason: 'Lote incorreto',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('bloqueia veterinário sem vínculo com a clínica nem autoria', async () => {
      mockPrismaService.vaccination.findUnique.mockResolvedValue(
        existingVaccination,
      );
      mockPrismaService.veterinarian.findUnique.mockResolvedValue({
        id: 'vet-2',
      });
      mockPrismaService.clinicVeterinarian.findUnique.mockResolvedValue(null);

      await expect(
        service.rectify('user-2', 'veterinarian', 'vaccination-1', {
          reason: 'Lote incorreto',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('retifica o lote e registra a auditoria', async () => {
      mockPrismaService.vaccination.findUnique.mockResolvedValue(
        existingVaccination,
      );
      const vaccinationUpdate = jest.fn().mockResolvedValue({
        status: VaccinationStatus.rectified,
      });
      const rectificationCreate = jest
        .fn()
        .mockResolvedValue({ id: 'rectification-1' });
      mockPrismaService.$transaction.mockImplementation((cb: TxCallback) =>
        cb({
          vaccination: { update: vaccinationUpdate },
          vaccinationRectification: { create: rectificationCreate },
        }),
      );

      const result = await service.rectify(
        'user-1',
        'veterinarian',
        'vaccination-1',
        { reason: 'Lote informado incorretamente', batchNumber: 'LOT2' },
      );

      expect(result).toEqual({
        vaccinationId: 'vaccination-1',
        status: VaccinationStatus.rectified,
        rectificationId: 'rectification-1',
        updatedFields: ['batchNumber'],
      });
      expect(vaccinationUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            batchNumber: 'LOT2',
            status: VaccinationStatus.rectified,
          }) as unknown,
        }),
      );
      expect(rectificationCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            vaccinationId: 'vaccination-1',
            rectifiedBy: 'user-1',
            reason: 'Lote informado incorretamente',
          }) as unknown,
        }),
      );
    });
  });

  describe('verifyByToken', () => {
    it('retorna valid:false quando o token não existe', async () => {
      mockPrismaService.vaccination.findUnique.mockResolvedValue(null);

      await expect(service.verifyByToken('bogus')).resolves.toEqual({
        valid: false,
      });
    });

    it('retorna valid:false quando a vacinação foi anulada', async () => {
      mockPrismaService.vaccination.findUnique.mockResolvedValue({
        status: VaccinationStatus.voided,
      });

      await expect(service.verifyByToken('token')).resolves.toEqual({
        valid: false,
      });
    });

    it('retorna os dados públicos quando válido', async () => {
      mockPrismaService.vaccination.findUnique.mockResolvedValue({
        status: VaccinationStatus.confirmed,
        doseNumber: 1,
        appliedAt: new Date('2026-01-01T10:00:00.000Z'),
        pet: { name: 'Thor', species: 'dog' },
        vaccine: { name: 'V10' },
        veterinarian: { crmv: 'SP-12345' },
        clinic: { tradeName: 'PetCare', legalName: 'PetCare LTDA' },
      });

      const result = await service.verifyByToken('token');

      expect(result).toEqual({
        valid: true,
        petName: 'Thor',
        species: 'dog',
        vaccineName: 'V10',
        doseNumber: 1,
        appliedAt: new Date('2026-01-01T10:00:00.000Z'),
        veterinarianCrmv: 'SP-12345',
        clinicName: 'PetCare',
        status: VaccinationStatus.confirmed,
      });
    });
  });
});
