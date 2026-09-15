import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForUser(userId: string, query: ListNotificationsQueryDto) {
    const { page, limit, unreadOnly } = query;

    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(unreadOnly && { status: { not: NotificationStatus.read } }),
    };

    const total = await this.prisma.notification.count({ where });

    const data = await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, meta: this.buildMeta(page, limit, total) };
  }

  /** Marca uma notificação como lida. Não lança se já estava lida (idempotente). */
  async markAsRead(userId: string, id: string) {
    const notification = await this.getOwnNotificationOrThrow(userId, id);

    if (notification.status === NotificationStatus.read) {
      return notification;
    }

    return this.prisma.notification.update({
      where: { id },
      data: { status: NotificationStatus.read, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, status: { not: NotificationStatus.read } },
      data: { status: NotificationStatus.read, readAt: new Date() },
    });

    return { updated: result.count };
  }

  /** `404` também quando a notificação existe mas pertence a outro usuário — evita vazar sua existência. */
  private async getOwnNotificationOrThrow(userId: string, id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notificação não encontrada');
    }
    return notification;
  }

  private buildMeta(page: number, limit: number, total: number) {
    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }
}
