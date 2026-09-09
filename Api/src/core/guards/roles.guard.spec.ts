import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let guard: RolesGuard;

  const contextWithUser = (user: unknown) =>
    ({
      getHandler: () => () => undefined,
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('libera rotas sem @Roles', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(contextWithUser(undefined))).toBe(true);
  });

  it('libera quando o papel do usuário está entre os exigidos', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.veterinarian]);
    expect(
      guard.canActivate(contextWithUser({ role: UserRole.veterinarian })),
    ).toBe(true);
  });

  it('bloqueia quando o papel do usuário não está entre os exigidos', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.platform_admin]);
    expect(() =>
      guard.canActivate(contextWithUser({ role: UserRole.tutor })),
    ).toThrow(ForbiddenException);
  });

  it('bloqueia quando não há usuário na request', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.tutor]);
    expect(() => guard.canActivate(contextWithUser(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
