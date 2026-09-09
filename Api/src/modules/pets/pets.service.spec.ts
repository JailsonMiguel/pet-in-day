import { Test, TestingModule } from '@nestjs/testing';
import { PetsService } from './pets.service';
import { PrismaService } from '../../core/database/prisma.service';
import { PetSpecies, PetStatus, UserRole } from '@prisma/client';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ListPetsQueryDto } from './dto/list-pets-query.dto';

type TxCallback = (tx: unknown) => unknown;

const query = (
  overrides: Partial<ListPetsQueryDto> = {},
): ListPetsQueryDto => ({
  page: 1,
  limit: 20,
  ...overrides,
});

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
      count: jest.fn(),
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

  describe('findAllForTutor', () => {
    it('retorna lista vazia com meta zerado quando o usuário não é tutor', async () => {
      mockPrismaService.tutor.findUnique.mockResolvedValue(null);

      const result = await service.findAllForTutor('user-id-1', query());

      expect(result).toEqual({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
      expect(mockPrismaService.tutorPet.findMany).not.toHaveBeenCalled();
    });

    it('pagina e mapeia os pets do tutor', async () => {
      mockPrismaService.tutor.findUnique.mockResolvedValue({
        id: 'tutor-id-1',
      });
      mockPrismaService.tutorPet.count.mockResolvedValue(3);
      mockPrismaService.tutorPet.findMany.mockResolvedValue([
        {
          isPrimary: true,
          relationship: 'Tutor Principal',
          pet: { id: 'pet-1', name: 'Thor' },
        },
      ]);

      const result = await service.findAllForTutor(
        'user-id-1',
        query({ page: 2, limit: 1 }),
      );

      expect(result.meta).toEqual({
        page: 2,
        limit: 1,
        total: 3,
        totalPages: 3,
      });
      expect(result.data).toEqual([
        {
          id: 'pet-1',
          name: 'Thor',
          isPrimary: true,
          relationship: 'Tutor Principal',
        },
      ]);
      expect(mockPrismaService.tutorPet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 1, take: 1 }),
      );
    });

    it('aplica os filtros de status e espécie no where', async () => {
      mockPrismaService.tutor.findUnique.mockResolvedValue({
        id: 'tutor-id-1',
      });
      mockPrismaService.tutorPet.count.mockResolvedValue(0);
      mockPrismaService.tutorPet.findMany.mockResolvedValue([]);

      await service.findAllForTutor(
        'user-id-1',
        query({ status: PetStatus.active, species: PetSpecies.cat }),
      );

      expect(mockPrismaService.tutorPet.count).toHaveBeenCalledWith({
        where: {
          tutorId: 'tutor-id-1',
          pet: {
            deletedAt: null,
            status: PetStatus.active,
            species: PetSpecies.cat,
          },
        },
      });
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

  describe('update', () => {
    beforeEach(() => {
      mockPrismaService.pet.findFirst.mockResolvedValue({
        id: 'pet-id-1',
        deletedAt: null,
      });
    });

    it('bloqueia co-tutor (vínculo não principal)', async () => {
      mockPrismaService.tutor.findUnique.mockResolvedValue({ id: 'tutor-2' });
      mockPrismaService.tutorPet.findUnique.mockResolvedValue({
        isPrimary: false,
      });

      await expect(
        service.update('user-2', UserRole.tutor, 'pet-id-1', { name: 'Novo' }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.pet.update).not.toHaveBeenCalled();
    });

    it('permite o tutor principal', async () => {
      mockPrismaService.tutor.findUnique.mockResolvedValue({ id: 'tutor-1' });
      mockPrismaService.tutorPet.findUnique.mockResolvedValue({
        isPrimary: true,
      });
      mockPrismaService.pet.update.mockResolvedValue({
        id: 'pet-id-1',
        name: 'Novo',
      });

      const result = await service.update(
        'user-1',
        UserRole.tutor,
        'pet-id-1',
        { name: 'Novo' },
      );

      expect(result).toEqual({ id: 'pet-id-1', name: 'Novo' });
    });

    it('permite platform_admin sem checar vínculo', async () => {
      mockPrismaService.pet.update.mockResolvedValue({ id: 'pet-id-1' });

      await service.update('admin', UserRole.platform_admin, 'pet-id-1', {
        name: 'X',
      });

      expect(mockPrismaService.tutorPet.findUnique).not.toHaveBeenCalled();
      expect(mockPrismaService.pet.update).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      mockPrismaService.pet.findFirst.mockResolvedValue({
        id: 'pet-id-1',
        deletedAt: null,
      });
    });

    it('bloqueia co-tutor (vínculo não principal)', async () => {
      mockPrismaService.tutor.findUnique.mockResolvedValue({ id: 'tutor-2' });
      mockPrismaService.tutorPet.findUnique.mockResolvedValue({
        isPrimary: false,
      });

      await expect(
        service.remove('user-2', UserRole.tutor, 'pet-id-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.pet.update).not.toHaveBeenCalled();
    });

    it('faz soft delete quando é o tutor principal', async () => {
      const now = new Date('2026-01-01T00:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);

      mockPrismaService.tutor.findUnique.mockResolvedValue({ id: 'tutor-1' });
      mockPrismaService.tutorPet.findUnique.mockResolvedValue({
        isPrimary: true,
      });
      mockPrismaService.pet.update.mockResolvedValue({});

      await service.remove('user-1', UserRole.tutor, 'pet-id-1');

      expect(mockPrismaService.pet.update).toHaveBeenCalledWith({
        where: { id: 'pet-id-1' },
        data: { deletedAt: now, status: PetStatus.archived },
      });

      jest.useRealTimers();
    });
  });
});
