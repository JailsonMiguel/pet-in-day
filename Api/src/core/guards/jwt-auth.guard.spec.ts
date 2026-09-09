import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let guard: JwtAuthGuard;

  const context = {
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new JwtAuthGuard(reflector as unknown as Reflector);
  });

  it('libera a rota marcada com @Public sem delegar ao AuthGuard', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const parent = Object.getPrototypeOf(JwtAuthGuard.prototype) as {
      canActivate: unknown;
    };
    const superSpy = jest.spyOn(parent, 'canActivate' as never);

    expect(guard.canActivate(context)).toBe(true);
    expect(superSpy).not.toHaveBeenCalled();
  });

  it('delega ao AuthGuard quando a rota não é pública', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const parent = Object.getPrototypeOf(JwtAuthGuard.prototype) as {
      canActivate: unknown;
    };
    const superSpy = jest
      .spyOn(parent, 'canActivate' as never)
      .mockReturnValue(true as never);

    expect(guard.canActivate(context)).toBe(true);
    expect(superSpy).toHaveBeenCalledWith(context);
  });
});
