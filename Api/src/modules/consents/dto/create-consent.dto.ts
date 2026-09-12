import { IsUUID } from 'class-validator';

/** Autoriza uma clínica a acessar/tratar este pet (consentimento LGPD). */
export class CreateConsentDto {
  @IsUUID()
  clinicId: string;
}
