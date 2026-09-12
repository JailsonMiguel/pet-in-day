import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../core/types/authenticated-user';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionStatusDto } from './dto/update-prescription-status.dto';
import { PrescriptionsService } from './prescriptions.service';

// Leitura/edição são autorizadas por recurso no service (veterinário
// autor, colega da mesma clínica, ou platform_admin) — @Roles só na criação.
@Controller('v1/prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Post()
  @Roles(UserRole.veterinarian)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePrescriptionDto,
  ) {
    const data = await this.prescriptionsService.create(user.id, dto);
    return { data };
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const data = await this.prescriptionsService.findOne(
      user.id,
      user.role,
      id,
    );
    return { data };
  }

  @Patch(':id')
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePrescriptionStatusDto,
  ) {
    const data = await this.prescriptionsService.updateStatus(
      user.id,
      user.role,
      id,
      dto,
    );
    return { data };
  }
}
