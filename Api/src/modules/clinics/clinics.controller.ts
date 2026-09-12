import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../core/types/authenticated-user';
import { ClinicsService } from './clinics.service';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { LinkVeterinarianDto } from './dto/link-veterinarian.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';

// Autenticação garantida pelo `JwtAuthGuard` global. Autorização por recurso
// (admin da clínica) é feita no service, no mesmo padrão do PetsService.
@Controller('v1/clinics')
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateClinicDto,
  ) {
    const data = await this.clinicsService.create(user.id, dto);
    return { data };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.clinicsService.findOne(id);
    return { data };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateClinicDto,
  ) {
    const data = await this.clinicsService.update(user.id, user.role, id, dto);
    return { data };
  }

  @Post(':id/veterinarians')
  async linkVeterinarian(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: LinkVeterinarianDto,
  ) {
    const data = await this.clinicsService.linkVeterinarian(
      user.id,
      user.role,
      id,
      dto,
    );
    return { data };
  }
}
