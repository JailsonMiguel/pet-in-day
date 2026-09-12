import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Public } from '../../core/decorators/public.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../core/types/authenticated-user';
import { CreateVaccinationDto } from './dto/create-vaccination.dto';
import { RectifyVaccinationDto } from './dto/rectify-vaccination.dto';
import { VaccinationsService } from './vaccinations.service';

@Controller('v1/vaccinations')
export class VaccinationsController {
  constructor(private readonly vaccinationsService: VaccinationsService) {}

  @Post()
  @Roles(UserRole.veterinarian)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVaccinationDto,
  ) {
    const data = await this.vaccinationsService.create(user.id, dto);
    return { data };
  }

  // Precisa vir antes de `:id` — senão "verify" seria capturado como um id.
  @Public()
  @Get('verify/:qrCodeToken')
  async verify(@Param('qrCodeToken') qrCodeToken: string) {
    const data = await this.vaccinationsService.verifyByToken(qrCodeToken);
    return { data };
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const data = await this.vaccinationsService.findOne(user.id, user.role, id);
    return { data };
  }

  @Post(':id/rectify')
  async rectify(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RectifyVaccinationDto,
  ) {
    const data = await this.vaccinationsService.rectify(
      user.id,
      user.role,
      id,
      dto,
    );
    return { data };
  }
}
