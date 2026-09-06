import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(NodeEnv, {
    message: `NODE_ENV deve ser um de: ${Object.values(NodeEnv).join(', ')}`,
  })
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty({ message: 'DATABASE_URL é obrigatória' })
  DATABASE_URL: string;

  @IsString()
  @MinLength(32, {
    message: 'JWT_SECRET deve ter no mínimo 32 caracteres',
  })
  JWT_SECRET: string;

  @IsInt()
  @Min(60)
  JWT_ACCESS_EXPIRES_IN_SECONDS: number = 3600;

  @IsInt()
  @Min(1)
  JWT_REFRESH_EXPIRES_IN_DAYS: number = 7;

  /**
   * Allowlist de origens permitidas no CORS, separadas por vírgula.
   * Ex.: "https://app.petemdia.com,https://admin.petemdia.com".
   * Vazio em desenvolvimento libera qualquer origem; vazio em produção
   * bloqueia todas as requisições cross-origin.
   */
  @IsString()
  @IsOptional()
  CORS_ORIGINS: string = '';

  /** Janela do rate limit global, em segundos. */
  @IsInt()
  @Min(1)
  THROTTLE_TTL_SECONDS: number = 60;

  /** Número máximo de requisições por janela, por IP, no rate limit global. */
  @IsInt()
  @Min(1)
  THROTTLE_LIMIT: number = 100;
}

/**
 * Valida e converte as variáveis de ambiente no boot da aplicação.
 * Qualquer variável ausente ou inválida interrompe a inicialização,
 * evitando que a API suba com configuração insegura (ex.: sem JWT_SECRET).
 */
export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((error) => Object.values(error.constraints ?? {}).join('; '))
      .join('\n  - ');
    throw new Error(`Configuração de ambiente inválida:\n  - ${messages}`);
  }

  return validatedConfig;
}
