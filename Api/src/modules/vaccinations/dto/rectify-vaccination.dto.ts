import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Retificação auditada: nunca edita a vacinação diretamente, sempre via este fluxo. */
export class RectifyVaccinationDto {
  @IsString()
  @IsNotEmpty({ message: 'O motivo da retificação é obrigatório' })
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  batchNumber?: string;

  @IsOptional()
  @IsDateString()
  batchExpiry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  applicationSite?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
