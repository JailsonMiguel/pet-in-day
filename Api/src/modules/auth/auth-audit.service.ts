import { Injectable, Logger } from '@nestjs/common';
import { AuthEventType } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';

/** Metadados da request associados a um evento de autenticação. */
export interface AuthContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthAuditEvent extends AuthContext {
  eventType: AuthEventType;
  success: boolean;
  userId?: string | null;
  email?: string | null;
  /** Motivo em caso de falha (ex.: `invalid_password`, `account_blocked`). */
  reason?: string | null;
}

/**
 * Grava a trilha de auditoria de autenticação (LGPD). As escritas são
 * best-effort: uma falha ao registrar o evento é logada, mas nunca
 * interrompe o fluxo de login/refresh/logout.
 */
@Injectable()
export class AuthAuditService {
  private readonly logger = new Logger(AuthAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(event: AuthAuditEvent): Promise<void> {
    try {
      await this.prisma.authAuditLog.create({
        data: {
          eventType: event.eventType,
          success: event.success,
          userId: event.userId ?? null,
          email: event.email ?? null,
          ipAddress: event.ipAddress ?? null,
          userAgent: event.userAgent ?? null,
          reason: event.reason ?? null,
        },
      });
    } catch (err) {
      this.logger.error(
        `Falha ao gravar AuthAuditLog (${event.eventType})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
