import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Injeta o usuário autenticado (ou uma de suas propriedades, se `data` for
 * informado) a partir da request. Deve ser usado atrás de um guard que
 * popule `request.user`, como o `JwtAuthGuard`.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: AuthenticatedUser }>();
    const user = request.user;

    return data ? user[data] : user;
  },
);
