import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PetSpecies, PetStatus } from '@prisma/client';

export const PET_SORT_FIELDS = [
  'createdAt',
  '-createdAt',
  'name',
  '-name',
] as const;

export type PetSortField = (typeof PET_SORT_FIELDS)[number];

/** Query string de `GET /v1/pets`: paginação, filtros e ordenação. */
export class ListPetsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsEnum(PetStatus)
  status?: PetStatus;

  @IsOptional()
  @IsEnum(PetSpecies)
  species?: PetSpecies;

  /** Campo de ordenação; prefixo `-` para decrescente. Padrão: `-createdAt`. */
  @IsOptional()
  @IsIn(PET_SORT_FIELDS)
  sort?: PetSortField;
}
