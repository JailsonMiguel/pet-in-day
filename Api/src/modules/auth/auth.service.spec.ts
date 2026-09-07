import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserStatus } from '@prisma/client';
import { AuthService } from './auth.service';
import { AuthAuditService } from './auth-audit.service';
import { PrismaService } from '../../core/database/prisma.service';

jest.mock('bcrypt');
const bcryptCompare = bcrypt.compare as jest.Mock;
const bcryptHash = bcrypt.hash as jest.Mock;

// `expect.any(...)` é tipado como `any`; encapsula para satisfazer o lint.
const anyDate = expect.any(Date) as unknown;
const anyString = expect.any(String) as unknown;

describe('AuthService', () => {
  let service: AuthService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    tutor: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    consent: {
      createMany: jest.fn(),
    },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('signed.access.token'),
  };

  const configValues: Record<string, unknown> = {
    JWT_ACCESS_EXPIRES_IN_SECONDS: 3600,
    JWT_REFRESH_EXPIRES_IN_DAYS: 7,
  };
  const mockConfigService = {
    get: jest.fn((key: string) => configValues[key]),
  };

  const mockAuditService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AuthAuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('deve estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    const dto = { email: 'tutor@petemdia.com', password: 'senha-forte' };

    it('lança UnauthorizedException se o usuário não existe', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('lança UnauthorizedException se a senha estiver incorreta', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: dto.email,
        passwordHash: 'hash',
        status: UserStatus.active,
      });
      bcryptCompare.mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'login_failure',
          success: false,
          userId: 'user-1',
          reason: 'invalid_password',
        }),
      );
    });

    it('lança UnauthorizedException se a conta estiver bloqueada', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: dto.email,
        passwordHash: 'hash',
        status: UserStatus.blocked,
      });
      bcryptCompare.mockResolvedValue(true);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'login_failure',
          reason: 'account_blocked',
        }),
      );
    });

    it('retorna o par de tokens e atualiza lastLoginAt em caso de sucesso', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: dto.email,
        passwordHash: 'hash',
        role: 'tutor',
        status: UserStatus.active,
        tutor: { fullName: 'Fulano de Tal' },
        veterinarian: null,
      });
      bcryptCompare.mockResolvedValue(true);
      mockPrismaService.user.update.mockResolvedValue({});
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.login(dto);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { lastLoginAt: anyDate },
      });
      expect(result.accessToken).toBe('signed.access.token');
      expect(result.refreshToken).toEqual(anyString);
      expect(result.expiresIn).toBe(3600);
      expect(result.user).toMatchObject({
        id: 'user-1',
        email: dto.email,
        role: 'tutor',
        fullName: 'Fulano de Tal',
      });
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'login_success',
          success: true,
          userId: 'user-1',
        }),
      );
    });
  });

  describe('refreshTokens', () => {
    it('lança UnauthorizedException se o refresh token não existe', async () => {
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(null);

      await expect(
        service.refreshTokens({ refreshToken: 'inexistente' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'token_refresh_failure',
          success: false,
          reason: 'invalid_or_expired',
        }),
      );
    });

    it('lança UnauthorizedException se o refresh token foi revogado', async () => {
      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
        user: { id: 'user-1', email: 'a@b.com', role: 'tutor' },
      });

      await expect(
        service.refreshTokens({ refreshToken: 'revogado' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lança UnauthorizedException se o refresh token expirou', async () => {
      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
        user: { id: 'user-1', email: 'a@b.com', role: 'tutor' },
      });

      await expect(
        service.refreshTokens({ refreshToken: 'expirado' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('revoga o token usado (rotation) e emite um novo par', async () => {
      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86_400_000),
        user: { id: 'user-1', email: 'a@b.com', role: 'tutor' },
      });
      mockPrismaService.refreshToken.update.mockResolvedValue({});
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.refreshTokens({ refreshToken: 'valido' });

      expect(mockPrismaService.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revokedAt: anyDate },
      });
      expect(result.accessToken).toBe('signed.access.token');
      expect(result.refreshToken).toEqual(anyString);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'token_refresh',
          success: true,
          userId: 'user-1',
        }),
      );
    });
  });

  describe('logout', () => {
    it('revoga o refresh token quando ele existe e está ativo', async () => {
      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        revokedAt: null,
      });
      mockPrismaService.refreshToken.update.mockResolvedValue({});

      await service.logout({ refreshToken: 'valido' });

      expect(mockPrismaService.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revokedAt: anyDate },
      });
    });

    it('não faz nada quando o refresh token não existe', async () => {
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(null);

      await service.logout({ refreshToken: 'inexistente' });

      expect(mockPrismaService.refreshToken.update).not.toHaveBeenCalled();
    });

    it('é idempotente para um token já revogado', async () => {
      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        revokedAt: new Date(),
      });

      await service.logout({ refreshToken: 'revogado' });

      expect(mockPrismaService.refreshToken.update).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    const dto = {
      email: 'novo@petemdia.com',
      password: 'senha-forte',
      fullName: 'Novo Tutor',
      cpf: '123.456.789-09',
      phone: '11999999999',
    };

    it('lança ConflictException se o e-mail já está cadastrado', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('lança ConflictException se o CPF já está cadastrado', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.tutor.findUnique.mockResolvedValue({ id: 'tutor-1' });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('normaliza o CPF (remove máscara) ao checar duplicidade', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.tutor.findUnique.mockResolvedValue(null);
      bcryptHash.mockResolvedValue('hash');
      mockPrismaService.$transaction.mockResolvedValue({
        user: {
          id: 'user-1',
          email: dto.email,
          role: 'tutor',
          status: UserStatus.active,
        },
        tutor: { id: 'tutor-1' },
      });

      await service.register(dto);

      expect(mockPrismaService.tutor.findUnique).toHaveBeenCalledWith({
        where: { cpf: '12345678909' },
      });
    });
  });
});
