import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AddressDto } from './address.dto';

export class CreateClinicDto {
  /** Aceita qualquer formatação; o serviço remove os não-dígitos e exige 14. */
  @IsString()
  @IsNotEmpty({ message: 'CNPJ é obrigatório' })
  cnpj: string;

  @IsString()
  @MaxLength(255)
  legalName: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  tradeName?: string;

  @IsEmail({}, { message: 'Formato de e-mail inválido' })
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;
}
