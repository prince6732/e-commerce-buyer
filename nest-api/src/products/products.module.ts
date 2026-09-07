import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { VariantAttributeValuesService } from './variant-attribute-values.service';
import { ProductsGateway } from './products.gateway';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, VariantAttributeValuesService, ProductsGateway],
  exports: [ProductsService, ProductsGateway],
})
export class ProductsModule {}

