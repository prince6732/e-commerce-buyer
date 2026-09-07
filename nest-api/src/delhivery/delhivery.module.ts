import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DelhiveryController } from './delhivery.controller';
import { DelhiveryService } from './delhivery.service';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';
import { AuditModule } from '../audit/audit.module';
import { ReturnsModule } from '../returns/returns.module';
import { RtoModule } from '../rto/rto.module';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    NotificationsModule,
    MailModule,
    AuditModule,
    forwardRef(() => ReturnsModule),
    forwardRef(() => RtoModule),
  ],
  controllers: [DelhiveryController],
  providers: [DelhiveryService],
  exports: [DelhiveryService],
})
export class DelhiveryModule {}
