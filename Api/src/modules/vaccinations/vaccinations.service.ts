import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  PetStatus,
  PrescriptionStatus,
  UserRole,
  VaccinationStatus,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateVaccinationDto } from './dto/create-vaccination.dto';
import { RectifyVaccinationDto } from './dto/rectify-vaccination.dto';

const INCLUDE_DETAILS = {
  vaccine: true,
  veterinarian: true,
  clinic: true,
  pet: true,
} as const;

@Injectable()
export class VaccinationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateVaccinationDto) {
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
        'Pet arquivado ou falecido não pode receber vacinação',
      );
    }

    const vaccine = await this.prisma.vaccine.findUnique({
      where: { id: dto.vaccineId },
    });
    if (!vaccine) {
      throw new NotFoundException('Vacina não encontrada');
    }

    const appliedAt = new Date(dto.appliedAt);
    const batchExpiry = new Date(dto.batchExpiry);
    if (batchExpiry < appliedAt) {
      throw new BadRequestException(
        'A validade do lote não pode ser anterior à data de aplicação',
      );
    }

    if (dto.prescriptionId) {
      const prescription = await this.prisma.prescription.findUnique({
        where: { id: dto.prescriptionId },
      });
      if (!prescription) {
        throw new NotFoundException('Prescrição não encontrada');
      }
      if (
        prescription.petId !== dto.petId ||
        prescription.vaccineId !== dto.vaccineId
      ) {
        throw new BadRequestException(
          'A prescrição não corresponde ao pet/vacina informados',
        );
      }
      if (prescription.doseNumber !== dto.doseNumber) {
        throw new BadRequestException(
          'O número da dose não corresponde ao da prescrição',
        );
      }
      if (prescription.status === PrescriptionStatus.applied) {
        throw new ConflictException('Esta prescrição já foi aplicada');
      }
    }

    const nextProtocol = await this.prisma.vaccineProtocol.findUnique({
      where: {
        vaccineId_doseNumber: {
          vaccineId: dto.vaccineId,
          doseNumber: dto.doseNumber + 1,
        },
      },
    });
    const nextDoseAt =
      nextProtocol?.intervalDays != null
        ? this.addDays(appliedAt, nextProtocol.intervalDays)
        : null;

    await this.assertConsentGranted(dto.petId, dto.clinicId);

    const qrCodeToken = crypto.randomBytes(24).toString('hex');

    return this.prisma.$transaction(async (tx) => {
      const vaccination = await tx.vaccination.create({
        data: {
          prescriptionId: dto.prescriptionId,
          petId: dto.petId,
          vaccineId: dto.vaccineId,
          veterinarianId: veterinarian.id,
          clinicId: dto.clinicId,
          doseNumber: dto.doseNumber,
          batchNumber: dto.batchNumber,
          batchExpiry,
          applicationSite: dto.applicationSite,
          appliedAt,
          nextDoseAt,
          qrCodeToken,
          notes: dto.notes,
        },
        include: INCLUDE_DETAILS,
      });

      if (dto.prescriptionId) {
        await tx.prescription.update({
          where: { id: dto.prescriptionId },
          data: { status: PrescriptionStatus.applied },
        });
      }

      return vaccination;
    });
  }

  async findOne(userId: string, userRole: string, id: string) {
    const vaccination = await this.prisma.vaccination.findUnique({
      where: { id },
      include: INCLUDE_DETAILS,
    });

    if (!vaccination) {
      throw new NotFoundException('Vacinação não encontrada');
    }

    await this.assertClinicStaffOrOwnerOrAdmin(
      userId,
      userRole,
      vaccination.veterinarianId,
      vaccination.clinicId,
    );

    return vaccination;
  }

  async rectify(
    userId: string,
    userRole: string,
    id: string,
    dto: RectifyVaccinationDto,
  ) {
    const vaccination = await this.prisma.vaccination.findUnique({
      where: { id },
    });
    if (!vaccination) {
      throw new NotFoundException('Vacinação não encontrada');
    }

    await this.assertClinicStaffOrOwnerOrAdmin(
      userId,
      userRole,
      vaccination.veterinarianId,
      vaccination.clinicId,
    );

    const nextBatchNumber = dto.batchNumber ?? vaccination.batchNumber;
    const nextBatchExpiry = dto.batchExpiry
      ? new Date(dto.batchExpiry)
      : vaccination.batchExpiry;
    const nextApplicationSite =
      dto.applicationSite !== undefined
        ? dto.applicationSite
        : vaccination.applicationSite;
    const nextNotes = dto.notes !== undefined ? dto.notes : vaccination.notes;

    const previousSnapshot = {
      batchNumber: vaccination.batchNumber,
      batchExpiry: vaccination.batchExpiry.toISOString(),
      applicationSite: vaccination.applicationSite,
      notes: vaccination.notes,
    };
    const newSnapshot = {
      batchNumber: nextBatchNumber,
      batchExpiry: nextBatchExpiry.toISOString(),
      applicationSite: nextApplicationSite,
      notes: nextNotes,
    };

    const updatedFields = (
      Object.keys(newSnapshot) as (keyof typeof newSnapshot)[]
    ).filter((key) => newSnapshot[key] !== previousSnapshot[key]);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.vaccination.update({
        where: { id },
        data: {
          batchNumber: nextBatchNumber,
          batchExpiry: nextBatchExpiry,
          applicationSite: nextApplicationSite,
          notes: nextNotes,
          status: VaccinationStatus.rectified,
        },
      });

      const rectification = await tx.vaccinationRectification.create({
        data: {
          vaccinationId: id,
          rectifiedBy: userId,
          reason: dto.reason,
          previousData: previousSnapshot,
          newData: newSnapshot,
        },
      });

      return {
        vaccinationId: id,
        status: updated.status,
        rectificationId: rectification.id,
        updatedFields,
      };
    });
  }

  async verifyByToken(qrCodeToken: string) {
    const vaccination = await this.prisma.vaccination.findUnique({
      where: { qrCodeToken },
      include: INCLUDE_DETAILS,
    });

    if (!vaccination || vaccination.status === VaccinationStatus.voided) {
      return { valid: false };
    }

    return {
      valid: true,
      petName: vaccination.pet.name,
      species: vaccination.pet.species,
      vaccineName: vaccination.vaccine.name,
      doseNumber: vaccination.doseNumber,
      appliedAt: vaccination.appliedAt,
      veterinarianCrmv: vaccination.veterinarian.crmv,
      clinicName: vaccination.clinic.tradeName ?? vaccination.clinic.legalName,
      status: vaccination.status,
    };
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

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
