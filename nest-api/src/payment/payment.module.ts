import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { DatabaseModule } from '../database/database.module';
import { OrdersModule } from '../orders/orders.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [DatabaseModule, ConfigModule, OrdersModule, NotificationsModule, ProductsModule],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
