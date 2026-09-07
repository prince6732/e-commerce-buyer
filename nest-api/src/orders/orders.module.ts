import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { DatabaseModule } from '../database/database.module';
import { DelhiveryModule } from '../delhivery/delhivery.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [DatabaseModule, ConfigModule, forwardRef(() => DelhiveryModule), forwardRef(() => ProductsModule)],
  controllers: [OrdersController],
  providers: [OrdersService, InvoicePdfService],
  exports: [OrdersService, InvoicePdfService],
})
export class OrdersModule {}
