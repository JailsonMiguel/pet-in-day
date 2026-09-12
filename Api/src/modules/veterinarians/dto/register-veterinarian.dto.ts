import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterVeterinarianDto {
  @IsEmail({}, { message: 'Formato de e-mail inválido' })
  @IsNotEmpty({ message: 'E-mail é obrigatório' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Nome completo é obrigatório' })
  @MaxLength(200)
  fullName: string;

  @IsString()
  @IsNotEmpty({ message: 'CRMV é obrigatório' })
  @MaxLength(20)
  crmv: string;

  @IsString()
  @Length(2, 2, { message: 'UF do CRMV deve ter 2 letras' })
  crmvState: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  specialty?: string;
}
