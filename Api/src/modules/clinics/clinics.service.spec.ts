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

/** Simula `Prisma.Decimal` o suficiente para exercitar `search()` (só usa `.toNumber()`). */
const decimal = (value: number) => ({ toNumber: () => value });

describe('ClinicsService', () => {
  let service: ClinicsService;

  const mockPrismaService = {
    clinic: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    clinicUser: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    clinicVeterinarian: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    veterinarian: {
      findUnique: jest.fn(),
    },
    user: {
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

  describe('registerStaff', () => {
    beforeEach(() => {
      mockPrismaService.clinic.findFirst.mockResolvedValue({ id: 'clinic-1' });
      mockPrismaService.clinicUser.findUnique.mockResolvedValue({
        isActive: true,
        role: ClinicUserRole.admin,
      });
      mockPrismaService.user.findUnique.mockResolvedValue(null);
    });

    it('lança ForbiddenException se quem chama não for admin da clínica', async () => {
      mockPrismaService.clinicUser.findUnique.mockResolvedValue(null);

      await expect(
        service.registerStaff('user-2', UserRole.tutor, 'clinic-1', {
          email: 'recepcao@petcare.com',
          password: 'SenhaForte123',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lança ConflictException se o e-mail já existir', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-3' });

      await expect(
        service.registerStaff('user-1', UserRole.tutor, 'clinic-1', {
          email: 'recepcao@petcare.com',
          password: 'SenhaForte123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('cria o usuário (role=receptionist) e o vínculo com a clínica', async () => {
      const userCreate = jest.fn().mockResolvedValue({
        id: 'user-3',
        email: 'recepcao@petcare.com',
        role: UserRole.receptionist,
      });
      const clinicUserCreate = jest
        .fn()
        .mockResolvedValue({ id: 'clinic-user-3' });
      mockPrismaService.$transaction.mockImplementation((cb: TxCallback) =>
        cb({
          user: { create: userCreate },
          clinicUser: { create: clinicUserCreate },
        }),
      );

      const result = await service.registerStaff(
        'user-1',
        UserRole.tutor,
        'clinic-1',
        { email: 'recepcao@petcare.com', password: 'SenhaForte123' },
      );

      expect(result).toEqual({
        clinicUserId: 'clinic-user-3',
        userId: 'user-3',
        email: 'recepcao@petcare.com',
        role: UserRole.receptionist,
      });
      expect(userCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'recepcao@petcare.com',
            role: UserRole.receptionist,
          }) as unknown,
        }),
      );
      expect(clinicUserCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clinicId: 'clinic-1',
            userId: 'user-3',
            role: ClinicUserRole.receptionist,
            isActive: true,
          }) as unknown,
        }),
      );
    });
  });

  describe('findStaff', () => {
    it('lança ForbiddenException se quem chama não for admin da clínica', async () => {
      mockPrismaService.clinic.findFirst.mockResolvedValue({ id: 'clinic-1' });
      mockPrismaService.clinicUser.findUnique.mockResolvedValue(null);

      await expect(
        service.findStaff('user-2', UserRole.tutor, 'clinic-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lista os membros da clínica para o admin', async () => {
      mockPrismaService.clinic.findFirst.mockResolvedValue({ id: 'clinic-1' });
      mockPrismaService.clinicUser.findUnique.mockResolvedValue({
        isActive: true,
        role: ClinicUserRole.admin,
      });
      mockPrismaService.clinicUser.findMany.mockResolvedValue([
        { id: 'clinic-user-1', role: ClinicUserRole.admin },
      ]);

      const result = await service.findStaff(
        'user-1',
        UserRole.tutor,
        'clinic-1',
      );

      expect(result).toEqual([
        { id: 'clinic-user-1', role: ClinicUserRole.admin },
      ]);
      expect(mockPrismaService.clinicUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clinicId: 'clinic-1' } }) as unknown,
      );
    });
  });

  describe('removeStaff', () => {
    beforeEach(() => {
      mockPrismaService.clinic.findFirst.mockResolvedValue({ id: 'clinic-1' });
      mockPrismaService.clinicUser.findUnique.mockResolvedValue({
        isActive: true,
        role: ClinicUserRole.admin,
      });
    });

    it('lança NotFoundException se o membro não existir ou já estiver inativo', async () => {
      mockPrismaService.clinicUser.findUnique
        .mockResolvedValueOnce({ isActive: true, role: ClinicUserRole.admin })
        .mockResolvedValueOnce(null);

      await expect(
        service.removeStaff('user-1', UserRole.tutor, 'clinic-1', 'user-3'),
      ).rejects.toThrow(NotFoundException);
    });

    it('desativa o membro da clínica', async () => {
      mockPrismaService.clinicUser.findUnique
        .mockResolvedValueOnce({ isActive: true, role: ClinicUserRole.admin })
        .mockResolvedValueOnce({
          id: 'clinic-user-3',
          isActive: true,
        });
      mockPrismaService.clinicUser.update.mockResolvedValue({
        id: 'clinic-user-3',
        isActive: false,
      });

      const result = await service.removeStaff(
        'user-1',
        UserRole.tutor,
        'clinic-1',
        'user-3',
      );

      expect(result).toEqual({ id: 'clinic-user-3', isActive: false });
      expect(mockPrismaService.clinicUser.update).toHaveBeenCalledWith({
        where: { id: 'clinic-user-3' },
        data: { isActive: false },
      });
    });
  });

  describe('search', () => {
    // Ponto de referência: Praça da Sé, São Paulo.
    const referencePoint = { lat: -23.5505, lng: -46.6333 };

    const clinicNear = {
      id: 'clinic-near',
      latitude: decimal(-23.5505),
      longitude: decimal(-46.6333),
    };
    const clinicMid = {
      id: 'clinic-mid',
      latitude: decimal(-23.56),
      longitude: decimal(-46.64),
    };
    // Rio de Janeiro — a ~360km de distância, fora de qualquer raio razoável.
    const clinicFar = {
      id: 'clinic-far',
      latitude: decimal(-22.9068),
      longitude: decimal(-43.1729),
    };

    it('retorna apenas clínicas dentro do raio, ordenadas por distância', async () => {
      mockPrismaService.clinic.findMany.mockResolvedValue([
        clinicFar,
        clinicMid,
        clinicNear,
      ]);

      const result = await service.search({
        ...referencePoint,
        radiusKm: 10,
        page: 1,
        limit: 20,
      });

      expect(result.data.map((c) => c.id)).toEqual([
        'clinic-near',
        'clinic-mid',
      ]);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });
    });

    it('pagina o resultado já filtrado/ordenado', async () => {
      mockPrismaService.clinic.findMany.mockResolvedValue([
        clinicNear,
        clinicMid,
      ]);

      const result = await service.search({
        ...referencePoint,
        radiusKm: 10,
        page: 2,
        limit: 1,
      });

      expect(result.data.map((c) => c.id)).toEqual(['clinic-mid']);
      expect(result.meta).toEqual({
        page: 2,
        limit: 1,
        total: 2,
        totalPages: 2,
      });
    });

    it('só busca clínicas ativas, não deletadas e com coordenadas', async () => {
      mockPrismaService.clinic.findMany.mockResolvedValue([]);

      await service.search({
        ...referencePoint,
        radiusKm: 10,
        page: 1,
        limit: 20,
      });

      expect(mockPrismaService.clinic.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          isActive: true,
          latitude: { not: null },
          longitude: { not: null },
        },
      });
    });
  });
});
