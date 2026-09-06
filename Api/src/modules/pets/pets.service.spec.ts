import { Test, TestingModule } from '@nestjs/testing';
import { PetsService } from './pets.service';
import { PrismaService } from '../../core/database/prisma.service';
import { PetSpecies, PetStatus, UserRole } from '@prisma/client';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

type TxCallback = (tx: unknown) => unknown;

describe('PetsService', () => {
  let service: PetsService;

  const mockPrismaService = {
    tutor: {
      findUnique: jest.fn(),
    },
    pet: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    tutorPet: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PetsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PetsService>(PetsService);
    jest.clearAllMocks();
  });

  it('deve estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('deve lançar BadRequestException se usuário não for tutor', async () => {
      mockPrismaService.tutor.findUnique.mockResolvedValue(null);

      await expect(
        service.create('user-id-1', { name: 'Thor', species: PetSpecies.dog }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve criar um pet com sucesso', async () => {
      const mockTutor = { id: 'tutor-id-1', userId: 'user-id-1' };
      const mockCreatedPet = {
        id: 'pet-id-1',
        name: 'Thor',
        species: PetSpecies.dog,
        publicCode: 'ABC12345',
        status: PetStatus.active,
      };

      mockPrismaService.tutor.findUnique.mockResolvedValue(mockTutor);
      mockPrismaService.pet.findUnique.mockResolvedValue(null);
      mockPrismaService.$transaction.mockImplementation((cb: TxCallback) =>
        cb({
          pet: {
            create: jest.fn().mockResolvedValue(mockCreatedPet),
          },
          tutorPet: {
            create: jest.fn().mockResolvedValue({}),
          },
        }),
      );

      const result = await service.create('user-id-1', {
        name: 'Thor',
        species: PetSpecies.dog,
      });

      expect(result).toEqual(mockCreatedPet);
    });
  });

  describe('findOne', () => {
    it('deve retornar pet se for admin da plataforma', async () => {
      const mockPet = { id: 'pet-id-1', name: 'Thor', deletedAt: null };
      mockPrismaService.pet.findFirst.mockResolvedValue(mockPet);

      const result = await service.findOne(
        'admin-id',
        UserRole.platform_admin,
        'pet-id-1',
      );

      expect(result).toEqual(mockPet);
    });

    it('deve lançar NotFoundException se pet não existir', async () => {
      mockPrismaService.pet.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('user-id-1', UserRole.tutor, 'invalid-pet-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve lançar ForbiddenException se tutor não estiver vinculado ao pet', async () => {
      const mockPet = { id: 'pet-id-1', name: 'Thor', deletedAt: null };
      mockPrismaService.pet.findFirst.mockResolvedValue(mockPet);
      mockPrismaService.tutor.findUnique.mockResolvedValue({
        id: 'tutor-id-1',
      });
      mockPrismaService.tutorPet.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('user-id-1', UserRole.tutor, 'pet-id-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
