import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { VeterinariansService } from './veterinarians.service';

type TxCallback = (tx: unknown) => unknown;

describe('VeterinariansService', () => {
  let service: VeterinariansService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    veterinarian: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VeterinariansService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<VeterinariansService>(VeterinariansService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('lança ConflictException se o e-mail já existir', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });

      await expect(
        service.register({
          email: 'vet@example.com',
          password: 'SenhaForte123',
          fullName: 'Dr. Ricardo',
          crmv: 'SP-12345',
          crmvState: 'SP',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('lança ConflictException se o CRMV já existir', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.veterinarian.findUnique.mockResolvedValue({
        id: 'vet-1',
      });

      await expect(
        service.register({
          email: 'vet@example.com',
          password: 'SenhaForte123',
          fullName: 'Dr. Ricardo',
          crmv: 'SP-12345',
          crmvState: 'SP',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('cria usuário (role=veterinarian) e o perfil de veterinário', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.veterinarian.findUnique.mockResolvedValue(null);

      const userCreate = jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'vet@example.com',
        role: UserRole.veterinarian,
        status: UserStatus.active,
      });
      const veterinarianCreate = jest.fn().mockResolvedValue({
        id: 'vet-1',
        crmv: 'SP-12345',
      });
      mockPrismaService.$transaction.mockImplementation((cb: TxCallback) =>
        cb({
          user: { create: userCreate },
          veterinarian: { create: veterinarianCreate },
        }),
      );

      const result = await service.register({
        email: 'vet@example.com',
        password: 'SenhaForte123',
        fullName: 'Dr. Ricardo',
        crmv: ' sp-12345 ',
        crmvState: 'sp',
      });

      expect(result).toEqual({
        userId: 'user-1',
        email: 'vet@example.com',
        role: UserRole.veterinarian,
        status: UserStatus.active,
        veterinarianId: 'vet-1',
        crmv: 'SP-12345',
      });
      expect(userCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: UserRole.veterinarian,
            status: UserStatus.active,
          }) as unknown,
        }),
      );
      expect(veterinarianCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          crmv: 'SP-12345',
          crmvState: 'SP',
        }) as unknown,
      });
    });
  });

  describe('findMe', () => {
    it('lança NotFoundException quando o usuário não tem perfil de veterinário', async () => {
      mockPrismaService.veterinarian.findUnique.mockResolvedValue(null);

      await expect(service.findMe('user-1')).rejects.toThrow(NotFoundException);
    });

    it('retorna o perfil com as clínicas ativas vinculadas', async () => {
      mockPrismaService.veterinarian.findUnique.mockResolvedValue({
        id: 'vet-1',
        fullName: 'Dr. Ricardo',
        crmv: 'SP-12345',
        crmvState: 'SP',
        specialty: null,
        clinicVeterinarians: [
          {
            clinic: {
              id: 'clinic-1',
              legalName: 'Clínica PetCare LTDA',
              tradeName: 'PetCare',
              cnpj: '12345678000199',
            },
          },
        ],
      });

      const result = await service.findMe('user-1');

      expect(result).toEqual({
        id: 'vet-1',
        fullName: 'Dr. Ricardo',
        crmv: 'SP-12345',
        crmvState: 'SP',
        specialty: null,
        clinics: [
          {
            id: 'clinic-1',
            legalName: 'Clínica PetCare LTDA',
            tradeName: 'PetCare',
            cnpj: '12345678000199',
          },
        ],
      });
    });
  });
});
