import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../core/database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto, RefreshTokenDto } from './dto/login.dto';
import { UserRole, UserStatus, ConsentType } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    // 1. Verificar se e-mail já existe
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('E-mail já cadastrado');
    }

    // 2. Verificar se CPF de tutor já existe
    const cleanCpf = dto.cpf.replace(/\D/g, '');
    const existingTutor = await this.prisma.tutor.findUnique({
      where: { cpf: cleanCpf },
    });
    if (existingTutor) {
      throw new ConflictException('CPF já cadastrado');
    }

    // 3. Hash da senha
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // 4. Transaction para criar Usuário, Tutor e Consentimentos
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          role: UserRole.tutor,
          status: UserStatus.active, // Para cadastro B2C de tutor
        },
      });

      const tutor = await tx.tutor.create({
        data: {
          userId: user.id,
          fullName: dto.fullName,
          cpf: cleanCpf,
          phone: dto.phone,
        },
      });

      if (dto.consents && dto.consents.length > 0) {
        await tx.consent.createMany({
          data: dto.consents.map((c) => ({
            userId: user.id,
            consentType: c.type as ConsentType,
            version: c.version,
            granted: c.granted,
          })),
        });
      }

      return { user, tutor };
    });

    return {
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
      status: result.user.status,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        tutor: true,
        veterinarian: true,
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (user.status === UserStatus.blocked || user.status === UserStatus.inactive) {
      throw new UnauthorizedException('Conta bloqueada ou inativa');
    }

    // Atualizar último login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Gerar Tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    const fullName = user.tutor?.fullName || user.veterinarian?.fullName || 'Usuário';

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: 3600,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName,
      },
    };
  }

  async refreshTokens(dto: RefreshTokenDto) {
    const tokenHash = this.hashToken(dto.refreshToken);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    // Revogar token usado (Token Rotation)
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Gerar novo par
    const tokens = await this.generateTokens(
      storedToken.user.id,
      storedToken.user.email,
      storedToken.user.role,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: 3600,
    };
  }

  async logout(dto: RefreshTokenDto) {
    const tokenHash = this.hashToken(dto.refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (storedToken && !storedToken.revokedAt) {
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });
    }
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET || 'super-secret-key-petemdia',
      expiresIn: '1h',
    });

    const refreshTokenRaw = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(refreshTokenRaw);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Validade de 7 dias

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken: refreshTokenRaw };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
