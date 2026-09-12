import { Body, Controller, Get, Post } from '@nestjs/common';
import { Public } from '../../core/decorators/public.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../core/types/authenticated-user';
import { RegisterVeterinarianDto } from './dto/register-veterinarian.dto';
import { VeterinariansService } from './veterinarians.service';

@Controller('v1/veterinarians')
export class VeterinariansController {
  constructor(private readonly veterinariansService: VeterinariansService) {}

  // Autocadastro: ainda não há um usuário autenticado nesse ponto.
  @Public()
  @Post('register')
  async register(@Body() dto: RegisterVeterinarianDto) {
    const data = await this.veterinariansService.register(dto);
    return { data };
  }

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.veterinariansService.findMe(user.id);
    return { data };
  }
}
