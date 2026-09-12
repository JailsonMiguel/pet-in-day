import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreatePrescriptionDto {
  @IsUUID()
  petId: string;

  @IsUUID()
  clinicId: string;

  @IsUUID()
  vaccineId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  doseNumber?: number;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
