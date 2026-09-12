import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

/** Uma dose do esquema vacinal (ex.: 1ª dose, reforço anual). */
export class VaccineProtocolDto {
  @IsInt()
  @Min(1)
  doseNumber: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minAgeDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  intervalDays?: number;

  @IsOptional()
  @IsBoolean()
  isBooster?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
