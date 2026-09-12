import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../core/database/prisma.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { ListPetsQueryDto, PetSortField } from './dto/list-pets-query.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import {
  Prisma,
  PetStatus,
  PrescriptionStatus,
  UserRole,
} from '@prisma/client';

@Injectable()
export class PetsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreatePetDto) {
    const tutor = await this.prisma.tutor.findUnique({
      where: { userId },
    });

    if (!tutor) {
      throw new BadRequestException(
        'Usuário autenticado não possui perfil de Tutor',
      );
    }

    if (dto.microchip) {
      const existingMicrochip = await this.prisma.pet.findUnique({
        where: { microchip: dto.microchip },
      });
      if (existingMicrochip) {
        throw new ConflictException('Microchip já cadastrado para outro pet');
      }
    }

    const publicCode = this.generatePublicCode();

    const pet = await this.prisma.$transaction(async (tx) => {
      const newPet = await tx.pet.create({
        data: {
          publicCode,
          name: dto.name,
          species: dto.species,
          breed: dto.breed,
          sex: dto.sex,
          birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
          weightKg: dto.weightKg !== undefined ? dto.weightKg : null,
          microchip: dto.microchip,
          photoUrl: dto.photoUrl,
          status: PetStatus.active,
        },
      });

      await tx.tutorPet.create({
        data: {
          tutorId: tutor.id,
          petId: newPet.id,
          isPrimary: true,
          relationship: 'Tutor Principal',
        },
      });

      return newPet;
    });

    return pet;
  }

  async findAllForTutor(userId: string, query: ListPetsQueryDto) {
    const { page, limit } = query;
    const tutor = await this.prisma.tutor.findUnique({
      where: { userId },
    });

    if (!tutor) {
      return { data: [], meta: this.buildMeta(page, limit, 0) };
    }

    const where: Prisma.TutorPetWhereInput = {
      tutorId: tutor.id,
      pet: {
        deletedAt: null,
        ...(query.status && { status: query.status }),
        ...(query.species && { species: query.species }),
      },
    };

    const total = await this.prisma.tutorPet.count({ where });

    const tutorPets = await this.prisma.tutorPet.findMany({
      where,
      include: { pet: true },
      orderBy: { pet: this.resolveSort(query.sort) },
      skip: (page - 1) * limit,
      take: limit,
    });

    const data = tutorPets.map((tp) => ({
      ...tp.pet,
      isPrimary: tp.isPrimary,
      relationship: tp.relationship,
    }));

    return { data, meta: this.buildMeta(page, limit, total) };
  }

  async findOne(userId: string, userRole: string, petId: string) {
    const pet = await this.getActivePetOrThrow(petId);

    if (userRole === UserRole.platform_admin) {
      return pet;
    }

    const tutor = await this.prisma.tutor.findUnique({
      where: { userId },
    });

    if (!tutor) {
      throw new ForbiddenException('Acesso negado ao pet');
    }

    const hasLink = await this.prisma.tutorPet.findUnique({
      where: {
        tutorId_petId: {
          tutorId: tutor.id,
          petId,
        },
      },
    });

    if (!hasLink) {
      throw new ForbiddenException(
        'Você não tem permissão para acessar os dados deste pet',
      );
    }

    return pet;
  }

  /** Carteira de vacinação: histórico de aplicações + prescrições em aberto. */
  async getWallet(userId: string, userRole: string, petId: string) {
    const pet = await this.findOne(userId, userRole, petId);

    const [prescriptions, vaccinations] = await Promise.all([
      this.prisma.prescription.findMany({
        where: { petId },
        include: { vaccine: true },
        orderBy: { prescribedAt: 'desc' },
      }),
      this.prisma.vaccination.findMany({
        where: { petId },
        include: { vaccine: true, veterinarian: true, clinic: true },
        orderBy: { appliedAt: 'desc' },
      }),
    ]);

    const openPrescriptions = prescriptions.filter(
      (p) =>
        p.status === PrescriptionStatus.pending ||
        p.status === PrescriptionStatus.scheduled,
    );
    const now = new Date();
    const overduePrescriptions = openPrescriptions.filter(
      (p) => p.scheduledAt !== null && p.scheduledAt < now,
    );

    const summaryStatus =
      overduePrescriptions.length > 0
        ? 'overdue'
        : openPrescriptions.length > 0
          ? 'pending'
          : vaccinations.length > 0
            ? 'up_to_date'
            : 'unknown';

    const vaccinationEntries = vaccinations.map((v) => ({
      type: 'vaccination' as const,
      id: v.id,
      vaccine: {
        id: v.vaccine.id,
        name: v.vaccine.name,
        manufacturer: v.vaccine.manufacturer,
      },
      doseNumber: v.doseNumber,
      status: v.status,
      appliedAt: v.appliedAt,
      batchNumber: v.batchNumber,
      batchExpiry: v.batchExpiry,
      nextDoseAt: v.nextDoseAt,
      veterinarian: {
        fullName: v.veterinarian.fullName,
        crmv: v.veterinarian.crmv,
      },
      clinic: {
        tradeName: v.clinic.tradeName,
        cnpj: v.clinic.cnpj,
      },
      certificateUrl: v.certificateUrl,
      qrCodeToken: v.qrCodeToken,
      sortDate: v.appliedAt,
    }));

    const prescriptionEntries = openPrescriptions.map((p) => ({
      type: 'prescription' as const,
      id: p.id,
      vaccine: { id: p.vaccine.id, name: p.vaccine.name },
      doseNumber: p.doseNumber,
      status: p.status,
      scheduledAt: p.scheduledAt,
      prescribedAt: p.prescribedAt,
      sortDate: p.scheduledAt ?? p.prescribedAt,
    }));

    const entries = [...vaccinationEntries, ...prescriptionEntries]
      .sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime())
      .map((entry) => {
        const { sortDate, ...rest } = entry;
        void sortDate; // usado só para ordenar; não deve vazar na resposta
        return rest;
      });

    return {
      pet: {
        id: pet.id,
        publicCode: pet.publicCode,
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        birthDate: pet.birthDate,
        photoUrl: pet.photoUrl,
      },
      summary: {
        status: summaryStatus,
        totalApplied: vaccinations.length,
        totalPending: openPrescriptions.length,
        totalOverdue: overduePrescriptions.length,
      },
      entries,
    };
  }

  async update(
    userId: string,
    userRole: string,
    petId: string,
    dto: UpdatePetDto,
  ) {
    await this.getActivePetOrThrow(petId);
    await this.assertPrimaryTutorOrAdmin(userId, userRole, petId);

    if (dto.microchip) {
      const existingMicrochip = await this.prisma.pet.findFirst({
        where: {
          microchip: dto.microchip,
          id: { not: petId },
        },
      });

      if (existingMicrochip) {
        throw new ConflictException('Microchip já cadastrado para outro pet');
      }
    }

    const updatedPet = await this.prisma.pet.update({
      where: { id: petId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.species && { species: dto.species }),
        ...(dto.breed !== undefined && { breed: dto.breed }),
        ...(dto.sex && { sex: dto.sex }),
        ...(dto.birthDate !== undefined && {
          birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        }),
        ...(dto.weightKg !== undefined && { weightKg: dto.weightKg }),
        ...(dto.microchip !== undefined && { microchip: dto.microchip }),
        ...(dto.photoUrl !== undefined && { photoUrl: dto.photoUrl }),
        ...(dto.status && { status: dto.status }),
      },
    });

    return updatedPet;
  }

  async remove(userId: string, userRole: string, petId: string) {
    await this.getActivePetOrThrow(petId);
    await this.assertPrimaryTutorOrAdmin(userId, userRole, petId);

    // Soft delete: marca `deletedAt` e move o status para `archived`.
    await this.prisma.pet.update({
      where: { id: petId },
      data: {
        deletedAt: new Date(),
        status: PetStatus.archived,
      },
    });

    return { message: 'Pet removido com sucesso' };
  }

  private async getActivePetOrThrow(petId: string) {
    const pet = await this.prisma.pet.findFirst({
      where: { id: petId, deletedAt: null },
    });

    if (!pet) {
      throw new NotFoundException('Pet não encontrado');
    }

    return pet;
  }

  /**
   * Alterar ou remover um pet é exclusivo do tutor principal (`isPrimary`) ou de
   * um `platform_admin`. Co-tutores têm apenas leitura.
   */
  private async assertPrimaryTutorOrAdmin(
    userId: string,
    userRole: string,
    petId: string,
  ): Promise<void> {
    if (userRole === UserRole.platform_admin) {
      return;
    }

    const tutor = await this.prisma.tutor.findUnique({
      where: { userId },
    });

    if (!tutor) {
      throw new ForbiddenException('Acesso negado ao pet');
    }

    const link = await this.prisma.tutorPet.findUnique({
      where: {
        tutorId_petId: {
          tutorId: tutor.id,
          petId,
        },
      },
    });

    if (!link) {
      throw new ForbiddenException(
        'Você não tem permissão para acessar os dados deste pet',
      );
    }

    if (!link.isPrimary) {
      throw new ForbiddenException(
        'Apenas o tutor principal pode alterar ou remover este pet',
      );
    }
  }

  private resolveSort(
    sort: PetSortField | undefined,
  ): Prisma.PetOrderByWithRelationInput {
    switch (sort) {
      case 'createdAt':
        return { createdAt: 'asc' };
      case 'name':
        return { name: 'asc' };
      case '-name':
        return { name: 'desc' };
      case '-createdAt':
      default:
        return { createdAt: 'desc' };
    }
  }

  private buildMeta(page: number, limit: number, total: number) {
    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  private generatePublicCode(): string {
    return crypto.randomBytes(6).toString('hex').toUpperCase();
  }
}
