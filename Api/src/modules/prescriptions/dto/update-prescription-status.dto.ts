import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PrescriptionStatus } from '@prisma/client';

export class UpdatePrescriptionStatusDto {
  @IsOptional()
  @IsEnum(PrescriptionStatus)
  status?: PrescriptionStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
