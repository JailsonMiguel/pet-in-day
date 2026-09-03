import { PartialType } from '@nestjs/mapped-types';
import { CreatePetDto } from './create-pet.dto';
import { IsOptional, IsEnum } from 'class-validator';
import { PetStatus } from '@prisma/client';

export class UpdatePetDto extends PartialType(CreatePetDto) {
  @IsOptional()
  @IsEnum(PetStatus)
  status?: PetStatus;
}
