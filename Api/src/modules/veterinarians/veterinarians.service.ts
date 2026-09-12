import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { RegisterVeterinarianDto } from './dto/register-veterinarian.dto';

@Injectable()
export class VeterinariansService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterVeterinarianDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const cleanCrmv = dto.crmv.trim().toUpperCase();
    const existingVeterinarian = await this.prisma.veterinarian.findUnique({
      where: { crmv: cleanCrmv },
    });
    if (existingVeterinarian) {
      throw new ConflictException('CRMV já cadastrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          role: UserRole.veterinarian,
          status: UserStatus.active,
        },
      });

      const veterinarian = await tx.veterinarian.create({
        data: {
          userId: user.id,
          fullName: dto.fullName,
          crmv: cleanCrmv,
          crmvState: dto.crmvState.toUpperCase(),
          specialty: dto.specialty,
        },
      });

      return { user, veterinarian };
    });

    return {
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
      status: result.user.status,
      veterinarianId: result.veterinarian.id,
      crmv: result.veterinarian.crmv,
    };
  }

  async findMe(userId: string) {
    const veterinarian = await this.prisma.veterinarian.findUnique({
      where: { userId },
      include: {
        clinicVeterinarians: {
          where: { isActive: true },
          include: { clinic: true },
        },
      },
    });

    if (!veterinarian) {
      throw new NotFoundException('Perfil de veterinário não encontrado');
    }

    return {
      id: veterinarian.id,
      fullName: veterinarian.fullName,
      crmv: veterinarian.crmv,
      crmvState: veterinarian.crmvState,
      specialty: veterinarian.specialty,
      clinics: veterinarian.clinicVeterinarians.map((link) => ({
        id: link.clinic.id,
        legalName: link.clinic.legalName,
        tradeName: link.clinic.tradeName,
        cnpj: link.clinic.cnpj,
      })),
    };
  }
}
