import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { AddressDto } from './address.dto';
import { CreateClinicDto } from './create-clinic.dto';

class UpdateAddressDto extends PartialType(AddressDto) {}

// `cnpj` não é editável (identificador de negócio imutável, mesmo padrão do CPF do tutor).
export class UpdateClinicDto extends PartialType(
  OmitType(CreateClinicDto, ['cnpj', 'address'] as const),
) {
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateAddressDto)
  address?: UpdateAddressDto;
}
