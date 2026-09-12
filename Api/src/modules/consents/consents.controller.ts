import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../core/types/authenticated-user';
import { ConsentsService } from './consents.service';
import { CreateConsentDto } from './dto/create-consent.dto';

// Consentimento LGPD tutor↔clínica: só o tutor decide quem acessa os dados do pet.
@Controller('v1/pets/:petId/consents')
export class ConsentsController {
  constructor(private readonly consentsService: ConsentsService) {}

  @Post()
  @Roles(UserRole.tutor)
  async grant(
    @CurrentUser() user: AuthenticatedUser,
    @Param('petId') petId: string,
    @Body() dto: CreateConsentDto,
  ) {
    const data = await this.consentsService.grant(user.id, petId, dto);
    return { data };
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('petId') petId: string,
  ) {
    const data = await this.consentsService.findAllForPet(
      user.id,
      user.role,
      petId,
    );
    return { data };
  }

  @Delete(':clinicId')
  @Roles(UserRole.tutor)
  async revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('petId') petId: string,
    @Param('clinicId') clinicId: string,
  ) {
    const data = await this.consentsService.revoke(user.id, petId, clinicId);
    return { data };
  }
}
