import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../core/types/authenticated-user';
import { RemindersService } from './reminders.service';

// Autorização por recurso no service (tutor vinculado ao pet, ou platform_admin).
@Controller('v1/pets/:petId/reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('petId') petId: string,
  ) {
    const data = await this.remindersService.findAllForPet(
      user.id,
      user.role,
      petId,
    );
    return { data };
  }
}
