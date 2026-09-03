import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './core/database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { PetsModule } from './modules/pets/pets.module';

@Module({
  imports: [PrismaModule, AuthModule, PetsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}


