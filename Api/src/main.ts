import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { EnvironmentVariables, NodeEnv } from './core/config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  // Encaminha todos os logs do Nest (inclusive os `Logger` de @nestjs/common)
  // para o pino configurado em LoggerModule.
  app.useLogger(app.get(PinoLogger));

  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  // Atrás de um reverse proxy (Railway/Render/nginx): confia no primeiro
  // X-Forwarded-* para que o rate limit use o IP real do cliente e o
  // helmet/HSTS enxergue o protocolo (HTTPS) correto.
  app.set('trust proxy', 1);

  // Cabeçalhos de segurança HTTP
  app.use(helmet());

  // CORS com allowlist controlada por env (CORS_ORIGINS, separada por vírgula)
  const allowlist = config
    .get('CORS_ORIGINS', { infer: true })
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  const isProduction =
    config.get('NODE_ENV', { infer: true }) === NodeEnv.Production;

  const corsOrigin = (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ): void => {
    // Requisições sem Origin (curl, apps mobile, same-origin) são permitidas.
    if (!origin) {
      return callback(null, true);
    }
    if (allowlist.includes(origin)) {
      return callback(null, true);
    }
    // Sem allowlist configurada: libera em dev, bloqueia em produção.
    if (allowlist.length === 0 && !isProduction) {
      return callback(null, true);
    }
    return callback(new Error(`Origem não permitida pelo CORS: ${origin}`));
  };

  app.enableCors({ origin: corsOrigin, credentials: true });

  if (allowlist.length === 0 && isProduction) {
    Logger.warn(
      'CORS_ORIGINS não configurada em produção: todas as requisições cross-origin serão bloqueadas.',
      'Bootstrap',
    );
  }

  // Pipe global de validação de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`🚀 Servidor rodando na porta: ${port}`, 'Bootstrap');
}
void bootstrap();
