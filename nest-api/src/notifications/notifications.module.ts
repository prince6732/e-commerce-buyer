import { Module, Global } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [NotificationsGateway, NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
