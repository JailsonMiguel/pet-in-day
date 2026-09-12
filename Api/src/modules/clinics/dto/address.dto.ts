import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class AddressDto {
  @IsString()
  @MaxLength(255)
  street: string;

  @IsString()
  @MaxLength(20)
  number: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  complement?: string;

  @IsString()
  @MaxLength(100)
  neighborhood: string;

  @IsString()
  @MaxLength(100)
  city: string;

  @IsString()
  @Length(2, 2, { message: 'UF deve ter 2 letras' })
  state: string;

  /** Aceita qualquer formatação; o serviço remove os não-dígitos e exige 8. */
  @IsString()
  zipCode: string;
}
