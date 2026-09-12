import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PetSpecies } from '@prisma/client';
import { VaccineProtocolDto } from './vaccine-protocol.dto';

export class CreateVaccineDto {
  @IsString()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  manufacturer?: string;

  @IsArray()
  @ArrayNotEmpty({ message: 'Informe ao menos uma espécie aplicável' })
  @IsEnum(PetSpecies, { each: true })
  species: PetSpecies[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VaccineProtocolDto)
  protocols?: VaccineProtocolDto[];
}
