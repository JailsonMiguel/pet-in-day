import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class RemindersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForPet(userId: string, userRole: string, petId: string) {
    await this.getActivePetOrThrow(petId);

    if (userRole !== UserRole.platform_admin) {
      await this.assertLinkedTutorOrThrow(userId, petId);
    }

    return this.prisma.vaccinationReminder.findMany({
      where: { petId },
      include: { vaccine: true },
      orderBy: { remindAt: 'asc' },
    });
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

  private async assertLinkedTutorOrThrow(
    userId: string,
    petId: string,
  ): Promise<void> {
    const tutor = await this.prisma.tutor.findUnique({ where: { userId } });
    if (!tutor) {
      throw new ForbiddenException('Acesso negado ao pet');
    }

    const link = await this.prisma.tutorPet.findUnique({
      where: { tutorId_petId: { tutorId: tutor.id, petId } },
    });
    if (!link) {
      throw new ForbiddenException(
        'Você não tem permissão para acessar os dados deste pet',
      );
    }
  }
}
