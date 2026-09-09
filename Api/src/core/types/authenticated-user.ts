import { Prisma } from '@prisma/client';

/**
 * Formato do usuário autenticado anexado à request pelo `JwtStrategy.validate`.
 * É um `select` enxuto do registro `User` — sem `passwordHash` / `mfaSecret` —
 * com apenas o `id` dos perfis `tutor` e `veterinarian`.
 */
export type AuthenticatedUser = Prisma.UserGetPayload<{
  select: {
    id: true;
    email: true;
    role: true;
    status: true;
    deletedAt: true;
    tutor: { select: { id: true } };
    veterinarian: { select: { id: true } };
  };
}>;
