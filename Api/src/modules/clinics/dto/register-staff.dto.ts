import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * Cadastro de recepção/staff pelo admin da clínica. Diferente do veterinário
 * (que se autocadastra), o staff não tem identidade profissional própria
 * para se cadastrar sozinho — por isso é a clínica quem provisiona a conta.
 */
export class RegisterStaffDto {
  @IsEmail({}, { message: 'Formato de e-mail inválido' })
  @IsNotEmpty({ message: 'E-mail é obrigatório' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres' })
  password: string;
}
