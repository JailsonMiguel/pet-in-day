import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateVaccinationDto {
  @IsOptional()
  @IsUUID()
  prescriptionId?: string;

  @IsUUID()
  petId: string;

  @IsUUID()
  clinicId: string;

  @IsUUID()
  vaccineId: string;

  @IsInt()
  @Min(1)
  doseNumber: number;

  @IsString()
  @MaxLength(50)
  batchNumber: string;

  @IsDateString()
  batchExpiry: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  applicationSite?: string;

  @IsDateString()
  appliedAt: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
