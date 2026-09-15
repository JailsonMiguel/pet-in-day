import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationStatus } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockPrismaService = {
    notification: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  describe('findAllForUser', () => {
    it('lista as notificações do usuário paginadas', async () => {
      mockPrismaService.notification.count.mockResolvedValue(1);
      mockPrismaService.notification.findMany.mockResolvedValue([
        { id: 'notif-1' },
      ]);

      const result = await service.findAllForUser('user-1', {
        page: 1,
        limit: 20,
      });

      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          skip: 0,
          take: 20,
        }) as unknown,
      );
      expect(result).toEqual({
        data: [{ id: 'notif-1' }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
    });

    it('filtra por não lidas quando unreadOnly=true', async () => {
      mockPrismaService.notification.count.mockResolvedValue(0);
      mockPrismaService.notification.findMany.mockResolvedValue([]);

      await service.findAllForUser('user-1', {
        page: 1,
        limit: 20,
        unreadOnly: true,
      });

      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-1',
            status: { not: NotificationStatus.read },
          },
        }) as unknown,
      );
    });
  });

  describe('markAsRead', () => {
    it('lança NotFoundException se a notificação não existir', async () => {
      mockPrismaService.notification.findUnique.mockResolvedValue(null);

      await expect(service.markAsRead('user-1', 'notif-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lança NotFoundException se a notificação pertencer a outro usuário', async () => {
      mockPrismaService.notification.findUnique.mockResolvedValue({
        id: 'notif-1',
        userId: 'other-user',
        status: NotificationStatus.pending,
      });

      await expect(service.markAsRead('user-1', 'notif-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('é idempotente quando já está lida', async () => {
      const alreadyRead = {
        id: 'notif-1',
        userId: 'user-1',
        status: NotificationStatus.read,
      };
      mockPrismaService.notification.findUnique.mockResolvedValue(alreadyRead);

      const result = await service.markAsRead('user-1', 'notif-1');

      expect(result).toEqual(alreadyRead);
      expect(mockPrismaService.notification.update).not.toHaveBeenCalled();
    });

    it('marca como lida e define readAt', async () => {
      mockPrismaService.notification.findUnique.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
        status: NotificationStatus.pending,
      });
      mockPrismaService.notification.update.mockResolvedValue({
        id: 'notif-1',
        status: NotificationStatus.read,
      });

      const result = await service.markAsRead('user-1', 'notif-1');

      expect(result).toEqual({
        id: 'notif-1',
        status: NotificationStatus.read,
      });
      expect(mockPrismaService.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'notif-1' },
          data: expect.objectContaining({
            status: NotificationStatus.read,
          }) as unknown,
        }),
      );
    });
  });

  describe('markAllAsRead', () => {
    it('marca todas as não lidas do usuário e retorna a contagem', async () => {
      mockPrismaService.notification.updateMany.mockResolvedValue({
        count: 3,
      });

      const result = await service.markAllAsRead('user-1');

      expect(result).toEqual({ updated: 3 });
      expect(mockPrismaService.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-1',
            status: { not: NotificationStatus.read },
          },
        }) as unknown,
      );
    });
  });
});
