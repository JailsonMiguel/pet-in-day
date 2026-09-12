import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {
  EnvironmentVariables,
  NodeEnv,
  validateEnv,
} from './core/config/env.validation';
import { GlobalExceptionFilter } from './core/filters/global-exception.filter';
import { JwtAuthGuard } from './core/guards/jwt-auth.guard';
import { RolesGuard } from './core/guards/roles.guard';
import { PrismaModule } from './core/database/prisma.module';
import { LoggerModule } from './core/logging/logger.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClinicsModule } from './modules/clinics/clinics.module';
import { ConsentsModule } from './modules/consents/consents.module';
import { PetsModule } from './modules/pets/pets.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { VaccinationsModule } from './modules/vaccinations/vaccinations.module';
import { VaccinesModule } from './modules/vaccines/vaccines.module';
import { VeterinariansModule } from './modules/veterinarians/veterinarians.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    LoggerModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        throttlers: [
          {
            ttl: config.get('THROTTLE_TTL_SECONDS', { infer: true }) * 1000,
            limit: config.get('THROTTLE_LIMIT', { infer: true }),
          },
        ],
        // Desliga o rate limit na suíte de testes para não gerar 429 espúrios.
        skipIf: () => config.get('NODE_ENV', { infer: true }) === NodeEnv.Test,
      }),
    }),
    PrismaModule,
    AuthModule,
    PetsModule,
    VaccinesModule,
    ClinicsModule,
    ConsentsModule,
    VeterinariansModule,
    PrescriptionsModule,
    VaccinationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Ordem importa: throttler → autenticação → autorização por papel.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
