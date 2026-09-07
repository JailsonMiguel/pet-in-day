import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { AuthAuditService } from './auth-audit.service';
import { PrismaService } from '../../core/database/prisma.service';

describe('AuthAuditService', () => {
  let service: AuthAuditService;

  const mockPrismaService = {
    authAuditLog: { create: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthAuditService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AuthAuditService>(AuthAuditService);
    jest.clearAllMocks();
  });

  it('persiste o evento normalizando campos ausentes para null', async () => {
    mockPrismaService.authAuditLog.create.mockResolvedValue({});

    await service.record({
      eventType: 'login_success',
      success: true,
      userId: 'user-1',
      email: 'tutor@petemdia.com',
      ipAddress: '203.0.113.9',
    });

    expect(mockPrismaService.authAuditLog.create).toHaveBeenCalledWith({
      data: {
        eventType: 'login_success',
        success: true,
        userId: 'user-1',
        email: 'tutor@petemdia.com',
        ipAddress: '203.0.113.9',
        userAgent: null,
        reason: null,
      },
    });
  });

  it('não propaga erro de persistência (auditoria é best-effort)', async () => {
    const errorLog = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    mockPrismaService.authAuditLog.create.mockRejectedValue(
      new Error('db indisponível'),
    );

    await expect(
      service.record({ eventType: 'logout', success: true }),
    ).resolves.toBeUndefined();

    expect(errorLog).toHaveBeenCalledTimes(1);
    errorLog.mockRestore();
  });
});
