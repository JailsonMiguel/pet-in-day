import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { PetSpecies, PetSex } from '@prisma/client';

export class CreatePetDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsEnum(PetSpecies)
  species: PetSpecies;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  breed?: string;

  @IsOptional()
  @IsEnum(PetSex)
  sex?: PetSex;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(200)
  weightKg?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  microchip?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string;
}
