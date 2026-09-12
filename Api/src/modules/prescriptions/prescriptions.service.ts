import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PetStatus, PrescriptionStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionStatusDto } from './dto/update-prescription-status.dto';

@Injectable()
export class PrescriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreatePrescriptionDto) {
    const veterinarian = await this.getVeterinarianOrThrow(userId);
    await this.assertActiveClinicLink(veterinarian.id, dto.clinicId);

    const pet = await this.prisma.pet.findFirst({
      where: { id: dto.petId, deletedAt: null },
    });
    if (!pet) {
      throw new NotFoundException('Pet não encontrado');
    }
    if (
      pet.status === PetStatus.archived ||
      pet.status === PetStatus.deceased
    ) {
      throw new UnprocessableEntityException(
        'Pet arquivado ou falecido não pode receber prescrições',
      );
    }

    const vaccine = await this.prisma.vaccine.findUnique({
      where: { id: dto.vaccineId },
    });
    if (!vaccine || !vaccine.isActive) {
      throw new NotFoundException('Vacina não encontrada');
    }

    await this.assertConsentGranted(dto.petId, dto.clinicId);

    return this.prisma.prescription.create({
      data: {
        petId: dto.petId,
        vaccineId: dto.vaccineId,
        veterinarianId: veterinarian.id,
        clinicId: dto.clinicId,
        doseNumber: dto.doseNumber ?? 1,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        notes: dto.notes,
      },
      include: { vaccine: true, veterinarian: true, clinic: true },
    });
  }

  async findOne(userId: string, userRole: string, id: string) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id },
      include: { vaccine: true, veterinarian: true, clinic: true, pet: true },
    });

    if (!prescription) {
      throw new NotFoundException('Prescrição não encontrada');
    }

    await this.assertClinicStaffOrOwnerOrAdmin(
      userId,
      userRole,
      prescription.veterinarianId,
      prescription.clinicId,
    );

    return prescription;
  }

  async updateStatus(
    userId: string,
    userRole: string,
    id: string,
    dto: UpdatePrescriptionStatusDto,
  ) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id },
    });
    if (!prescription) {
      throw new NotFoundException('Prescrição não encontrada');
    }

    await this.assertClinicStaffOrOwnerOrAdmin(
      userId,
      userRole,
      prescription.veterinarianId,
      prescription.clinicId,
    );

    if (dto.status === PrescriptionStatus.applied) {
      throw new BadRequestException(
        'Use POST /v1/vaccinations para registrar a aplicação da dose',
      );
    }

    return this.prisma.prescription.update({
      where: { id },
      data: {
        ...(dto.status && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  private async getVeterinarianOrThrow(userId: string) {
    const veterinarian = await this.prisma.veterinarian.findUnique({
      where: { userId },
    });
    if (!veterinarian) {
      throw new ForbiddenException(
        'Usuário autenticado não possui perfil de veterinário',
      );
    }
    return veterinarian;
  }

  private async assertActiveClinicLink(
    veterinarianId: string,
    clinicId: string,
  ): Promise<void> {
    const link = await this.prisma.clinicVeterinarian.findUnique({
      where: { clinicId_veterinarianId: { clinicId, veterinarianId } },
    });
    if (!link || !link.isActive) {
      throw new ForbiddenException('Veterinário não vinculado a esta clínica');
    }
  }

  /** Consentimento LGPD: o tutor precisa ter autorizado esta clínica a tratar do pet. */
  private async assertConsentGranted(
    petId: string,
    clinicId: string,
  ): Promise<void> {
    const consent = await this.prisma.clinicPetConsent.findFirst({
      where: { petId, clinicId, revokedAt: null },
    });
    if (!consent) {
      throw new ForbiddenException(
        'O tutor não autorizou esta clínica a tratar deste pet',
      );
    }
  }

  /** Acesso liberado para o veterinário autor, um colega ativo na mesma clínica, ou `platform_admin`. */
  private async assertClinicStaffOrOwnerOrAdmin(
    userId: string,
    userRole: string,
    ownerVeterinarianId: string,
    clinicId: string,
  ): Promise<void> {
    if (userRole === UserRole.platform_admin) {
      return;
    }

    const veterinarian = await this.getVeterinarianOrThrow(userId);
    if (veterinarian.id === ownerVeterinarianId) {
      return;
    }

    await this.assertActiveClinicLink(veterinarian.id, clinicId);
  }
}
