import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy, JwtPayload } from './jwt.strategy';
import { PrismaService } from '../../../core/database/prisma.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const mockPrismaService = {
    user: { findUnique: jest.fn() },
  };
  const mockConfigService = {
    get: jest.fn().mockReturnValue('a'.repeat(32)),
  };

  const payload: JwtPayload = {
    sub: 'user-1',
    email: 'tutor@petemdia.com',
    role: 'tutor',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    jest.clearAllMocks();
  });

  it('deve estar definido', () => {
    expect(strategy).toBeDefined();
  });

  it('retorna o usuário quando ele existe e está ativo', async () => {
    const user = { id: 'user-1', status: 'active', tutor: null };
    mockPrismaService.user.findUnique.mockResolvedValue(user);

    await expect(strategy.validate(payload)).resolves.toBe(user);
    expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } }),
    );
  });

  it('lança UnauthorizedException quando o usuário não existe mais', async () => {
    mockPrismaService.user.findUnique.mockResolvedValue(null);

    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('lança UnauthorizedException quando o usuário está bloqueado', async () => {
    mockPrismaService.user.findUnique.mockResolvedValue({
      id: 'user-1',
      status: 'blocked',
    });

    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('lança UnauthorizedException quando o usuário está inativo', async () => {
    mockPrismaService.user.findUnique.mockResolvedValue({
      id: 'user-1',
      status: 'inactive',
    });

    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('lança UnauthorizedException quando o usuário foi removido (soft delete)', async () => {
    mockPrismaService.user.findUnique.mockResolvedValue({
      id: 'user-1',
      status: 'active',
      deletedAt: new Date(),
    });

    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('consulta apenas campos não sensíveis do usuário (select explícito)', async () => {
    mockPrismaService.user.findUnique.mockResolvedValue({
      id: 'user-1',
      status: 'active',
    });

    await strategy.validate(payload);

    expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        deletedAt: true,
        tutor: { select: { id: true } },
        veterinarian: { select: { id: true } },
      },
    });
  });
});
