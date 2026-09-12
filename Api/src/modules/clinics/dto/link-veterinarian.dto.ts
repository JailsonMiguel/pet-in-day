import { IsNotEmpty, IsString } from 'class-validator';

/** Vincula um veterinário já cadastrado (`POST /v1/veterinarians/register`) à clínica pelo CRMV. */
export class LinkVeterinarianDto {
  @IsString()
  @IsNotEmpty({ message: 'CRMV é obrigatório' })
  crmv: string;
}
