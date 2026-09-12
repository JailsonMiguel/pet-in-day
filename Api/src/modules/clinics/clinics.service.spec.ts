import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ClinicUserRole, UserRole } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { ClinicsService } from './clinics.service';

type TxCallback = (tx: unknown) => unknown;

const validAddress = {
  street: 'Rua das Flores',
  number: '100',
  neighborhood: 'Centro',
  city: 'São Paulo',
  state: 'sp',
  zipCode: '01001-000',
};

describe('ClinicsService', () => {
  let service: ClinicsService;

  const mockPrismaService = {
    clinic: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    clinicUser: {
      findUnique: jest.fn(),
    },
    clinicVeterinarian: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    veterinarian: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ClinicsService>(ClinicsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('lança BadRequestException se o CNPJ não tiver 14 dígitos', async () => {
      await expect(
        service.create('user-1', {
          cnpj: '123',
          legalName: 'Clínica X',
          email: 'x@x.com',
          address: validAddress,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança BadRequestException se o CEP não tiver 8 dígitos', async () => {
      await expect(
        service.create('user-1', {
          cnpj: '12345678000199',
          legalName: 'Clínica X',
          email: 'x@x.com',
          address: { ...validAddress, zipCode: '123' },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança ConflictException se o CNPJ já existir', async () => {
      mockPrismaService.clinic.findUnique.mockResolvedValue({ id: 'clinic-1' });

      await expect(
        service.create('user-1', {
          cnpj: '12345678000199',
          legalName: 'Clínica X',
          email: 'x@x.com',
          address: validAddress,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('cria a clínica e vincula o criador como admin', async () => {
      const now = new Date('2026-01-01T00:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);

      mockPrismaService.clinic.findUnique.mockResolvedValue(null);
      const clinicCreate = jest
        .fn()
        .mockResolvedValue({ id: 'clinic-1', cnpj: '12345678000199' });
      const clinicUserCreate = jest.fn().mockResolvedValue({});
      mockPrismaService.$transaction.mockImplementation((cb: TxCallback) =>
        cb({
          clinic: { create: clinicCreate },
          clinicUser: { create: clinicUserCreate },
        }),
      );

      const result = await service.create('user-1', {
        cnpj: '12.345.678/0001-99',
        legalName: 'Clínica X',
        email: 'x@x.com',
        address: validAddress,
      });

      expect(result).toEqual({ id: 'clinic-1', cnpj: '12345678000199' });
      expect(clinicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cnpj: '12345678000199',
            zipCode: '01001000',
            state: 'SP',
          }) as unknown,
        }),
      );
      expect(clinicUserCreate).toHaveBeenCalledWith({
        data: {
          clinicId: 'clinic-1',
          userId: 'user-1',
          role: ClinicUserRole.admin,
          isActive: true,
          acceptedAt: now,
        },
      });

      jest.useRealTimers();
    });
  });

  describe('update', () => {
    beforeEach(() => {
      mockPrismaService.clinic.findFirst.mockResolvedValue({ id: 'clinic-1' });
    });

    it('lança NotFoundException se a clínica não existir', async () => {
      mockPrismaService.clinic.findFirst.mockResolvedValue(null);

      await expect(
        service.update('user-1', UserRole.tutor, 'clinic-1', {
          legalName: 'Novo Nome',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('bloqueia quem não é admin da clínica', async () => {
      mockPrismaService.clinicUser.findUnique.mockResolvedValue(null);

      await expect(
        service.update('user-2', UserRole.tutor, 'clinic-1', {
          legalName: 'Novo Nome',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.clinic.update).not.toHaveBeenCalled();
    });

    it('bloqueia membro ativo que não é admin (ex.: recepção)', async () => {
      mockPrismaService.clinicUser.findUnique.mockResolvedValue({
        isActive: true,
        role: ClinicUserRole.receptionist,
      });

      await expect(
        service.update('user-2', UserRole.tutor, 'clinic-1', {
          legalName: 'Novo Nome',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permite o admin da clínica', async () => {
      mockPrismaService.clinicUser.findUnique.mockResolvedValue({
        isActive: true,
        role: ClinicUserRole.admin,
      });
      mockPrismaService.clinic.update.mockResolvedValue({
        id: 'clinic-1',
        legalName: 'Novo Nome',
      });

      const result = await service.update(
        'user-1',
        UserRole.tutor,
        'clinic-1',
        {
          legalName: 'Novo Nome',
        },
      );

      expect(result).toEqual({ id: 'clinic-1', legalName: 'Novo Nome' });
    });

    it('permite platform_admin sem checar vínculo', async () => {
      mockPrismaService.clinic.update.mockResolvedValue({ id: 'clinic-1' });

      await service.update('admin', UserRole.platform_admin, 'clinic-1', {
        legalName: 'Novo Nome',
      });

      expect(mockPrismaService.clinicUser.findUnique).not.toHaveBeenCalled();
      expect(mockPrismaService.clinic.update).toHaveBeenCalled();
    });
  });

  describe('linkVeterinarian', () => {
    beforeEach(() => {
      mockPrismaService.clinic.findFirst.mockResolvedValue({ id: 'clinic-1' });
      mockPrismaService.clinicUser.findUnique.mockResolvedValue({
        isActive: true,
        role: ClinicUserRole.admin,
      });
    });

    it('lança NotFoundException se o CRMV não existir', async () => {
      mockPrismaService.veterinarian.findUnique.mockResolvedValue(null);

      await expect(
        service.linkVeterinarian('user-1', UserRole.tutor, 'clinic-1', {
          crmv: 'SP-12345',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança ConflictException se já houver vínculo', async () => {
      mockPrismaService.veterinarian.findUnique.mockResolvedValue({
        id: 'vet-1',
      });
      mockPrismaService.clinicVeterinarian.findUnique.mockResolvedValue({
        id: 'link-1',
      });

      await expect(
        service.linkVeterinarian('user-1', UserRole.tutor, 'clinic-1', {
          crmv: 'SP-12345',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('cria o vínculo quando tudo é válido', async () => {
      mockPrismaService.veterinarian.findUnique.mockResolvedValue({
        id: 'vet-1',
      });
      mockPrismaService.clinicVeterinarian.findUnique.mockResolvedValue(null);
      mockPrismaService.clinicVeterinarian.create.mockResolvedValue({
        id: 'link-1',
      });

      const result = await service.linkVeterinarian(
        'user-1',
        UserRole.tutor,
        'clinic-1',
        { crmv: ' sp-12345 ' },
      );

      expect(result).toEqual({ id: 'link-1' });
      expect(mockPrismaService.veterinarian.findUnique).toHaveBeenCalledWith({
        where: { crmv: 'SP-12345' },
      });
    });
  });
});
