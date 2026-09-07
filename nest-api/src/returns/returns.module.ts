import { Module, forwardRef } from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { ReturnEligibilityService } from './return-eligibility.service';
import { ExchangeService } from './exchange.service';
import { RefundService } from './refund.service';
import { ReturnsController } from './returns.controller';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';
import { AuditModule } from '../audit/audit.module';
import { InventoryModule } from '../inventory/inventory.module';
import { DelhiveryModule } from '../delhivery/delhivery.module';

@Module({
  imports: [
    DatabaseModule,
    NotificationsModule,
    MailModule,
    AuditModule,
    InventoryModule,
    forwardRef(() => DelhiveryModule),
  ],
  controllers: [ReturnsController],
  providers: [
    ReturnsService,
    ReturnEligibilityService,
    ExchangeService,
    RefundService,
  ],
  exports: [
    ReturnsService,
    ReturnEligibilityService,
    ExchangeService,
    RefundService,
  ],
})
export class ReturnsModule {}
