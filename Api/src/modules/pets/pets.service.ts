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
import { UpdatePetDto } from './dto/update-pet.dto';
import { PetStatus, UserRole } from '@prisma/client';

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

  async findAllForTutor(userId: string) {
    const tutor = await this.prisma.tutor.findUnique({
      where: { userId },
    });

    if (!tutor) {
      return [];
    }

    const tutorPets = await this.prisma.tutorPet.findMany({
      where: {
        tutorId: tutor.id,
        pet: {
          deletedAt: null,
        },
      },
      include: {
        pet: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return tutorPets.map((tp) => ({
      ...tp.pet,
      isPrimary: tp.isPrimary,
      relationship: tp.relationship,
    }));
  }

  async findOne(userId: string, userRole: string, petId: string) {
    const pet = await this.prisma.pet.findFirst({
      where: {
        id: petId,
        deletedAt: null,
      },
    });

    if (!pet) {
      throw new NotFoundException('Pet não encontrado');
    }

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

  async update(
    userId: string,
    userRole: string,
    petId: string,
    dto: UpdatePetDto,
  ) {
    await this.findOne(userId, userRole, petId);

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
    await this.findOne(userId, userRole, petId);

    await this.prisma.pet.update({
      where: { id: petId },
      data: {
        deletedAt: new Date(),
        status: PetStatus.archived,
      },
    });

    return { message: 'Pet removido com sucesso' };
  }

  private generatePublicCode(): string {
    return crypto.randomBytes(6).toString('hex').toUpperCase();
  }
}
