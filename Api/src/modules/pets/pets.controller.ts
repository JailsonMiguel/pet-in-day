import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PetsService } from './pets.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@Controller('v1/pets')
@UseGuards(JwtAuthGuard)
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

  @Post()
  async create(@CurrentUser() user: any, @Body() dto: CreatePetDto) {
    const data = await this.petsService.create(user.id, dto);
    return { data };
  }

  @Get()
  async findAll(@CurrentUser() user: any) {
    const data = await this.petsService.findAllForTutor(user.id);
    return { data };
  }

  @Get(':id')
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    const data = await this.petsService.findOne(user.id, user.role, id);
    return { data };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdatePetDto,
  ) {
    const data = await this.petsService.update(user.id, user.role, id, dto);
    return { data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    const data = await this.petsService.remove(user.id, user.role, id);
    return { data };
  }
}
