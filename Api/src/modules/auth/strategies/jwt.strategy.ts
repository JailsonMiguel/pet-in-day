import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { EnvironmentVariables } from '../../../core/config/env.validation';
import { PrismaService } from '../../../core/database/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
    });
  }

  async validate(payload: JwtPayload) {
    // `select` explícito: nunca anexa `passwordHash` / `mfaSecret` à request.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        deletedAt: true,
        tutor: { select: { id: true } },
        veterinarian: { select: { id: true } },
      },
    });

    if (
      !user ||
      user.deletedAt ||
      user.status === 'blocked' ||
      user.status === 'inactive'
    ) {
      throw new UnauthorizedException('Usuário inválido ou bloqueado');
    }

    return user;
  }
}
