import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PetSpecies } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { VaccinesService } from './vaccines.service';

describe('VaccinesService', () => {
  let service: VaccinesService;

  const mockPrismaService = {
    vaccine: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VaccinesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<VaccinesService>(VaccinesService);
    jest.clearAllMocks();
  });

  it('deve estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('cria a vacina com os protocolos aninhados', async () => {
      mockPrismaService.vaccine.create.mockResolvedValue({ id: 'vaccine-1' });

      await service.create({
        name: 'V10',
        species: [PetSpecies.dog],
        protocols: [{ doseNumber: 1 }],
      });

      expect(mockPrismaService.vaccine.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'V10',
          species: [PetSpecies.dog],
          protocols: { create: [{ doseNumber: 1 }] },
        }) as unknown,
        include: expect.any(Object) as unknown,
      });
    });

    it('não envia `protocols.create` quando nenhum protocolo é informado', async () => {
      mockPrismaService.vaccine.create.mockResolvedValue({ id: 'vaccine-1' });

      await service.create({ name: 'V10', species: [PetSpecies.dog] });

      expect(mockPrismaService.vaccine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ protocols: undefined }) as unknown,
        }),
      );
    });
  });

  describe('findAll', () => {
    it('filtra por espécie e isActive', async () => {
      mockPrismaService.vaccine.findMany.mockResolvedValue([]);

      await service.findAll({ species: PetSpecies.cat, isActive: true });

      expect(mockPrismaService.vaccine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { species: { has: PetSpecies.cat }, isActive: true },
        }),
      );
    });

    it('sem filtros, consulta com where vazio', async () => {
      mockPrismaService.vaccine.findMany.mockResolvedValue([]);

      await service.findAll({});

      expect(mockPrismaService.vaccine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });

  describe('findOne', () => {
    it('retorna a vacina quando existe', async () => {
      const vaccine = { id: 'vaccine-1', name: 'V10' };
      mockPrismaService.vaccine.findUnique.mockResolvedValue(vaccine);

      await expect(service.findOne('vaccine-1')).resolves.toEqual(vaccine);
    });

    it('lança NotFoundException quando não existe', async () => {
      mockPrismaService.vaccine.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('lança NotFoundException quando a vacina não existe', async () => {
      mockPrismaService.vaccine.findUnique.mockResolvedValue(null);

      await expect(service.update('missing', { name: 'Nova' })).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.vaccine.update).not.toHaveBeenCalled();
    });

    it('atualiza apenas os campos informados', async () => {
      mockPrismaService.vaccine.findUnique.mockResolvedValue({
        id: 'vaccine-1',
      });
      mockPrismaService.vaccine.update.mockResolvedValue({
        id: 'vaccine-1',
        isActive: false,
      });

      await service.update('vaccine-1', { isActive: false });

      expect(mockPrismaService.vaccine.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'vaccine-1' },
          data: { isActive: false },
        }),
      );
    });
  });
});
