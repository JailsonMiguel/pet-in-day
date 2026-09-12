import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClinicUserRole, UserRole } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { LinkVeterinarianDto } from './dto/link-veterinarian.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';

@Injectable()
export class ClinicsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateClinicDto) {
    const cleanCnpj = dto.cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) {
      throw new BadRequestException('CNPJ deve conter 14 dígitos');
    }

    const cleanZipCode = dto.address.zipCode.replace(/\D/g, '');
    if (cleanZipCode.length !== 8) {
      throw new BadRequestException('CEP deve conter 8 dígitos');
    }

    const existingClinic = await this.prisma.clinic.findUnique({
      where: { cnpj: cleanCnpj },
    });
    if (existingClinic) {
      throw new ConflictException('CNPJ já cadastrado');
    }

    return this.prisma.$transaction(async (tx) => {
      const clinic = await tx.clinic.create({
        data: {
          cnpj: cleanCnpj,
          legalName: dto.legalName,
          tradeName: dto.tradeName,
          email: dto.email,
          phone: dto.phone,
          street: dto.address.street,
          number: dto.address.number,
          complement: dto.address.complement,
          neighborhood: dto.address.neighborhood,
          city: dto.address.city,
          state: dto.address.state.toUpperCase(),
          zipCode: cleanZipCode,
        },
      });

      // Quem cria a clínica vira seu administrador (self-service onboarding).
      await tx.clinicUser.create({
        data: {
          clinicId: clinic.id,
          userId,
          role: ClinicUserRole.admin,
          isActive: true,
          acceptedAt: new Date(),
        },
      });

      return clinic;
    });
  }

  async findOne(clinicId: string) {
    const clinic = await this.prisma.clinic.findFirst({
      where: { id: clinicId, deletedAt: null },
    });

    if (!clinic) {
      throw new NotFoundException('Clínica não encontrada');
    }

    return clinic;
  }

  async update(
    userId: string,
    userRole: string,
    clinicId: string,
    dto: UpdateClinicDto,
  ) {
    await this.findOne(clinicId);
    await this.assertClinicAdminOrPlatformAdmin(userId, userRole, clinicId);

    const address = dto.address;

    return this.prisma.clinic.update({
      where: { id: clinicId },
      data: {
        ...(dto.legalName && { legalName: dto.legalName }),
        ...(dto.tradeName !== undefined && { tradeName: dto.tradeName }),
        ...(dto.email && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(address?.street && { street: address.street }),
        ...(address?.number && { number: address.number }),
        ...(address?.complement !== undefined && {
          complement: address.complement,
        }),
        ...(address?.neighborhood && { neighborhood: address.neighborhood }),
        ...(address?.city && { city: address.city }),
        ...(address?.state && { state: address.state.toUpperCase() }),
        ...(address?.zipCode && {
          zipCode: address.zipCode.replace(/\D/g, ''),
        }),
      },
    });
  }

  async linkVeterinarian(
    userId: string,
    userRole: string,
    clinicId: string,
    dto: LinkVeterinarianDto,
  ) {
    await this.findOne(clinicId);
    await this.assertClinicAdminOrPlatformAdmin(userId, userRole, clinicId);

    const veterinarian = await this.prisma.veterinarian.findUnique({
      where: { crmv: dto.crmv.trim().toUpperCase() },
    });

    if (!veterinarian) {
      throw new NotFoundException(
        'Nenhum veterinário cadastrado com esse CRMV',
      );
    }

    const existingLink = await this.prisma.clinicVeterinarian.findUnique({
      where: {
        clinicId_veterinarianId: {
          clinicId,
          veterinarianId: veterinarian.id,
        },
      },
    });

    if (existingLink) {
      throw new ConflictException('Veterinário já vinculado a esta clínica');
    }

    return this.prisma.clinicVeterinarian.create({
      data: {
        clinicId,
        veterinarianId: veterinarian.id,
        isActive: true,
        acceptedAt: new Date(),
      },
      include: { veterinarian: true },
    });
  }

  /** Alterar a clínica ou vincular veterinários é exclusivo do seu admin (ou `platform_admin`). */
  private async assertClinicAdminOrPlatformAdmin(
    userId: string,
    userRole: string,
    clinicId: string,
  ): Promise<void> {
    if (userRole === UserRole.platform_admin) {
      return;
    }

    const membership = await this.prisma.clinicUser.findUnique({
      where: { clinicId_userId: { clinicId, userId } },
    });

    if (
      !membership ||
      !membership.isActive ||
      membership.role !== ClinicUserRole.admin
    ) {
      throw new ForbiddenException(
        'Apenas administradores da clínica podem realizar esta ação',
      );
    }
  }
}
