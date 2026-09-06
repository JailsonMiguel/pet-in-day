import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

/** Envelope padrão de erro da API (espelha o `{ data }` das respostas de sucesso). */
export interface ErrorResponseBody {
  error: {
    statusCode: number;
    message: string | string[];
    path: string;
    method: string;
    timestamp: string;
  };
}

/**
 * Filtro global único: normaliza qualquer exceção num envelope consistente,
 * mapeia erros conhecidos do Prisma para status HTTP adequados e nunca vaza
 * stack trace, SQL ou mensagem interna para o cliente. Erros 5xx são logados
 * com stack; 4xx são logados em nível de depuração.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message } = this.resolve(exception);

    const body: ErrorResponseBody = {
      error: {
        statusCode: status,
        message,
        path: request.url,
        method: request.method,
        timestamp: new Date().toISOString(),
      },
    };

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.debug(
        `${request.method} ${request.url} -> ${status}: ${JSON.stringify(message)}`,
      );
    }

    response.status(status).json(body);
  }

  private resolve(exception: unknown): {
    status: number;
    message: string | string[];
  } {
    if (exception instanceof HttpException) {
      return {
        status: exception.getStatus(),
        message: this.extractHttpMessage(exception),
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.mapPrismaError(exception);
    }

    if (
      exception instanceof Prisma.PrismaClientValidationError ||
      exception instanceof Prisma.PrismaClientUnknownRequestError
    ) {
      return { status: HttpStatus.BAD_REQUEST, message: 'Dados inválidos' };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno do servidor',
    };
  }

  private extractHttpMessage(exception: HttpException): string | string[] {
    const res = exception.getResponse();
    if (typeof res === 'string') {
      return res;
    }
    const maybeMessage = (res as { message?: string | string[] }).message;
    if (typeof maybeMessage === 'string' || Array.isArray(maybeMessage)) {
      return maybeMessage;
    }
    return exception.message;
  }

  private mapPrismaError(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
  } {
    switch (exception.code) {
      case 'P2002': {
        const target = exception.meta?.target;
        const fields = Array.isArray(target) ? target.join(', ') : undefined;
        return {
          status: HttpStatus.CONFLICT,
          message: fields
            ? `Já existe um registro com esse valor de: ${fields}`
            : 'Registro duplicado',
        };
      }
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Registro não encontrado',
        };
      case 'P2003':
        return {
          status: HttpStatus.CONFLICT,
          message: 'Operação viola uma referência entre registros',
        };
      default:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Não foi possível processar a operação no banco de dados',
        };
    }
  }
}
