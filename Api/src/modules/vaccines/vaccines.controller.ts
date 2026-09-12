import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../core/decorators/roles.decorator';
import { CreateVaccineDto } from './dto/create-vaccine.dto';
import { ListVaccinesQueryDto } from './dto/list-vaccines-query.dto';
import { UpdateVaccineDto } from './dto/update-vaccine.dto';
import { VaccinesService } from './vaccines.service';

// Leitura: qualquer usuário autenticado. Escrita: apenas platform_admin.
@Controller('v1/vaccines')
export class VaccinesController {
  constructor(private readonly vaccinesService: VaccinesService) {}

  @Get()
  async findAll(@Query() query: ListVaccinesQueryDto) {
    const data = await this.vaccinesService.findAll(query);
    return { data };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.vaccinesService.findOne(id);
    return { data };
  }

  @Post()
  @Roles(UserRole.platform_admin)
  async create(@Body() dto: CreateVaccineDto) {
    const data = await this.vaccinesService.create(dto);
    return { data };
  }

  @Patch(':id')
  @Roles(UserRole.platform_admin)
  async update(@Param('id') id: string, @Body() dto: UpdateVaccineDto) {
    const data = await this.vaccinesService.update(id, dto);
    return { data };
  }
}
