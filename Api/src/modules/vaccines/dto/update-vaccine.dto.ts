import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateVaccineDto } from './create-vaccine.dto';

// `protocols` não é editável via PATCH nesta versão (evita diffs de doses);
// o esquema de doses é definido na criação da vacina.
export class UpdateVaccineDto extends PartialType(
  OmitType(CreateVaccineDto, ['protocols'] as const),
) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
