import { Module, Global, forwardRef } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { ProductsModule } from '../products/products.module';

@Global()
@Module({
  imports: [forwardRef(() => ProductsModule)],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
