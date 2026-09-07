import { Module, forwardRef } from '@nestjs/common';
import { RtoService } from './rto.service';
import { RtoController } from './rto.controller';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';
import { AuditModule } from '../audit/audit.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ReturnsModule } from '../returns/returns.module';
import { DelhiveryModule } from '../delhivery/delhivery.module';

@Module({
  imports: [
    DatabaseModule,
    NotificationsModule,
    MailModule,
    AuditModule,
    InventoryModule,
    ReturnsModule,
    forwardRef(() => DelhiveryModule),
  ],
  controllers: [RtoController],
  providers: [RtoService],
  exports: [RtoService],
})
export class RtoModule {}
