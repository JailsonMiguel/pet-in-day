import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClinicUserRole, NotificationChannel, UserRole } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateConsentDto } from './dto/create-consent.dto';

@Injectable()
export class ConsentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tutor autoriza uma clínica a acessar/tratar este pet (consentimento LGPD). */
  async grant(userId: string, petId: string, dto: CreateConsentDto) {
    const pet = await this.getActivePetOrThrow(petId);
    const tutor = await this.assertLinkedTutorOrThrow(userId, petId);

    const clinic = await this.prisma.clinic.findFirst({
      where: { id: dto.clinicId, deletedAt: null },
    });
    if (!clinic) {
      throw new NotFoundException('Clínica não encontrada');
    }

    const existing = await this.prisma.clinicPetConsent.findFirst({
      where: { clinicId: dto.clinicId, petId, revokedAt: null },
    });
    if (existing) {
      throw new ConflictException('Consentimento já concedido a esta clínica');
    }

    const consent = await this.prisma.clinicPetConsent.create({
      data: {
        clinicId: dto.clinicId,
        petId,
        tutorId: tutor.id,
      },
      include: { clinic: true },
    });

    await this.notifyClinicAdmins(dto.clinicId, {
      title: 'Novo consentimento de tutor',
      body: `O tutor autorizou sua clínica a atender o pet ${pet.name}.`,
      referenceId: consent.id,
    });

    return consent;
  }

  async findAllForPet(userId: string, userRole: string, petId: string) {
    await this.getActivePetOrThrow(petId);

    if (userRole !== UserRole.platform_admin) {
      await this.assertLinkedTutorOrThrow(userId, petId);
    }

    return this.prisma.clinicPetConsent.findMany({
      where: { petId },
      include: { clinic: true },
      orderBy: { grantedAt: 'desc' },
    });
  }

  async revoke(userId: string, petId: string, clinicId: string) {
    const pet = await this.getActivePetOrThrow(petId);
    await this.assertLinkedTutorOrThrow(userId, petId);

    const consent = await this.prisma.clinicPetConsent.findFirst({
      where: { clinicId, petId, revokedAt: null },
    });
    if (!consent) {
      throw new NotFoundException(
        'Nenhum consentimento ativo encontrado para esta clínica',
      );
    }

    const updated = await this.prisma.clinicPetConsent.update({
      where: { id: consent.id },
      data: { revokedAt: new Date() },
    });

    await this.notifyClinicAdmins(clinicId, {
      title: 'Consentimento revogado',
      body: `O tutor revogou a autorização da sua clínica para atender o pet ${pet.name}.`,
      referenceId: updated.id,
    });

    return updated;
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

  /** Qualquer tutor vinculado ao pet pode gerenciar o compartilhamento — não só o principal. */
  private async assertLinkedTutorOrThrow(userId: string, petId: string) {
    const tutor = await this.prisma.tutor.findUnique({ where: { userId } });
    if (!tutor) {
      throw new ForbiddenException('Acesso negado ao pet');
    }

    const link = await this.prisma.tutorPet.findUnique({
      where: { tutorId_petId: { tutorId: tutor.id, petId } },
    });
    if (!link) {
      throw new ForbiddenException(
        'Você não tem permissão para gerenciar o compartilhamento deste pet',
      );
    }

    return tutor;
  }

  /** Notifica (in-app) os admins ativos da clínica — sem envio real por push/e-mail/sms. */
  private async notifyClinicAdmins(
    clinicId: string,
    params: { title: string; body: string; referenceId: string },
  ): Promise<void> {
    const admins = await this.prisma.clinicUser.findMany({
      where: { clinicId, role: ClinicUserRole.admin, isActive: true },
      select: { userId: true },
    });

    if (admins.length === 0) {
      return;
    }

    await this.prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.userId,
        title: params.title,
        body: params.body,
        type: 'clinic_pet_consent',
        referenceType: 'clinic_pet_consent',
        referenceId: params.referenceId,
        channel: NotificationChannel.push,
      })),
    });
  }
}
