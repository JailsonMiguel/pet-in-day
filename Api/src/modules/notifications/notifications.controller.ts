import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../core/types/authenticated-user';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationsService } from './notifications.service';

// Sempre escopado ao usuário autenticado — não há leitura/edição de notificação alheia.
@Controller('v1/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListNotificationsQueryDto,
  ) {
    // Retorna { data, meta } — envelope de listagem paginada.
    return this.notificationsService.findAllForUser(user.id, query);
  }

  @Patch('read-all')
  async markAllAsRead(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.notificationsService.markAllAsRead(user.id);
    return { data };
  }

  @Patch(':id/read')
  async markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const data = await this.notificationsService.markAsRead(user.id, id);
    return { data };
  }
}
