import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { EnvironmentVariables, NodeEnv } from '../config/env.validation';

/**
 * Logging estruturado (JSON) via pino. Em produção emite uma linha JSON por
 * evento; fora de produção usa `pino-pretty`. Cabeçalhos e campos sensíveis
 * são redigidos antes de qualquer escrita.
 */
@Module({
  exports: [PinoLoggerModule],
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => {
        const isProduction =
          config.get('NODE_ENV', { infer: true }) === NodeEnv.Production;
        const isTest = config.get('NODE_ENV', { infer: true }) === NodeEnv.Test;

        return {
          pinoHttp: {
            level: config.get('LOG_LEVEL', { infer: true }),
            // Silencia o logger de request na suíte de testes.
            autoLogging: !isTest,
            redact: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.headers["x-api-key"]',
              'res.headers["set-cookie"]',
            ],
            customLogLevel: (_req, res, err) => {
              if (err || res.statusCode >= 500) return 'error';
              if (res.statusCode >= 400) return 'warn';
              return 'info';
            },
            transport: isProduction
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: { singleLine: true, translateTime: 'SYS:standard' },
                },
          },
        };
      },
    }),
  ],
})
export class LoggerModule {}
