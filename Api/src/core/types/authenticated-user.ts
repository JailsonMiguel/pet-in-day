import { Prisma } from '@prisma/client';

/**
 * Formato do usuário autenticado anexado à request pelo `JwtStrategy.validate`
 * (registro `User` com os perfis `tutor` e `veterinarian` carregados).
 */
export type AuthenticatedUser = Prisma.UserGetPayload<{
  include: { tutor: true; veterinarian: true };
}>;
