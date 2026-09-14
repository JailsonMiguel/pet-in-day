import { Module } from '@nestjs/common';
import { PetsController } from './pets.controller';
import { PetsService } from './pets.service';
import { WalletPdfService } from './wallet-pdf.service';

@Module({
  controllers: [PetsController],
  providers: [PetsService, WalletPdfService],
  exports: [PetsService],
})
export class PetsModule {}
