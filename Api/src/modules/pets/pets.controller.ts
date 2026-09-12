import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PetsService } from './pets.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { ListPetsQueryDto } from './dto/list-pets-query.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../core/types/authenticated-user';

// Autenticação garantida pelo `JwtAuthGuard` global (AppModule).
@Controller('v1/pets')
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePetDto,
  ) {
    const data = await this.petsService.create(user.id, dto);
    return { data };
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPetsQueryDto,
  ) {
    // Retorna { data, meta } — envelope de listagem paginada.
    return this.petsService.findAllForTutor(user.id, query);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const data = await this.petsService.findOne(user.id, user.role, id);
    return { data };
  }

  @Get(':id/wallet')
  async getWallet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const data = await this.petsService.getWallet(user.id, user.role, id);
    return { data };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePetDto,
  ) {
    const data = await this.petsService.update(user.id, user.role, id, dto);
    return { data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const data = await this.petsService.remove(user.id, user.role, id);
    return { data };
  }
}
