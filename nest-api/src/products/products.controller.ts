import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ProductsService } from './products.service';
import { VariantAttributeValuesService } from './variant-attribute-values.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller()
export class ProductsController {
  constructor(
    private svc: ProductsService,
    private vavSvc: VariantAttributeValuesService,
  ) {}

  // === PUBLIC PRODUCT ROUTES ===
  @Get('products')                            index(): Promise<any>                         { return this.svc.index(); }
  @Get('products-paginated')                  paginated(@Query() q: any): Promise<any>      { return this.svc.getAllProductsPaginated(q); }
  @Get('products/:id')                        show(@Param('id') id: string): Promise<any>   { return this.svc.show(id); }
  @Get('get-product/:id')                     getProduct(@Param('id') id: string, @Req() req?: any): Promise<any> { return this.svc.getProductById(id, req); }
  @Get('search-products')                     search(@Query() q: any): Promise<any>         { return this.svc.search(q); }
  @Get('get-products-by-category/:id')        byCategory(@Param('id') id: string): Promise<any> { return this.svc.getSubcategoryProduct(id); }
  @Get('get-similar-products/:id')            similar(@Param('id') id: string, @Query() q: any): Promise<any> { return this.svc.getSimilarProducts(id, q); }
  @Get('most-ordered-products')               mostOrdered(@Query() q: any): Promise<any>    { return this.svc.getMostOrderedProducts(q); }
  @Get('top-selling-products')                topSelling(@Query() q: any): Promise<any>     { return this.svc.getTopSellingProducts(q); }
  @Get('debug-order-data')                    debugData(): Promise<any>                     { return this.svc.debugOrderData(); }
  @Get('new-arrival-products')                newArrivals(@Query() q: any): Promise<any>     { return this.svc.getNewArrivalProducts(q); }

  // === PUBLIC VARIANT ROUTES ===
  @Get('variants')                            variantIndex(): Promise<any>                  { return this.svc.getVariants(); }
  @Get('get-variant/:id')                     variantShow(@Param('id') id: string): Promise<any> { return this.svc.showVariant(+id); }

  // === ADMIN PRODUCT ROUTES ===
  @UseGuards(JwtAuthGuard)
  @Get('admin-products')                      adminProducts(@Query() q: any): Promise<any>  { return this.svc.getAdminProducts(q); }

  @UseGuards(JwtAuthGuard)
  @Get('admin-product-details/:id')           adminProductDetails(@Param('id') id: string): Promise<any> { return this.svc.getProductDetails(id); }

  @UseGuards(JwtAuthGuard)
  @Get('admin-search-products')               adminSearch(@Query() q: any): Promise<any> { return this.svc.search(q); }

  @UseGuards(JwtAuthGuard)
  @Post('create-product')
  store(@Body() b: any): Promise<any> { return this.svc.store(b); }

  @UseGuards(JwtAuthGuard)
  @Put('update-product/:id')
  update(@Param('id') id: string, @Body() b: any) { return this.svc.update(+id, b); }

  @UseGuards(JwtAuthGuard)
  @Delete('delete-product/:id')
  destroy(@Param('id') id: string) { return this.svc.destroy(+id); }

  @UseGuards(JwtAuthGuard)
  @Patch('product/:id/status')
  changeStatus(@Param('id') id: string) { return this.svc.changeStatus(+id); }

  @UseGuards(JwtAuthGuard)
  @Patch('products/:id/toggle-new-arrival')
  toggleNewArrival(@Param('id') id: string) { return this.svc.toggleNewArrival(+id); }

  // === ADMIN VARIANT ROUTES ===
  @UseGuards(JwtAuthGuard)
  @Post('create-variant')
  storeVariant(@Body() b: any) { return this.svc.storeVariant(b); }

  @UseGuards(JwtAuthGuard)
  @Put('update-variant/:id')
  updateVariant(@Param('id') id: string, @Body() b: any) { return this.svc.updateVariant(+id, b); }

  @UseGuards(JwtAuthGuard)
  @Delete('delete-variant/:id')
  destroyVariant(@Param('id') id: string) { return this.svc.destroyVariant(+id); }

  @UseGuards(JwtAuthGuard)
  @Patch('variant/:id/status')
  changeVariantStatus(@Param('id') id: string) { return this.svc.changeVariantStatus(+id); }

  // === VARIANT ATTRIBUTE VALUES (Pivot) ===
  // GET /variant/:variantId/attribute-values  [Public]
  @Get('variant/:variantId/attribute-values')
  getVariantAttributeValues(@Param('variantId') id: string) { return this.vavSvc.index(+id); }

  // POST /variant/:variantId/attach-attribute-values  [Admin]
  @UseGuards(JwtAuthGuard)
  @Post('variant/:variantId/attach-attribute-values')
  attachAttributeValues(@Param('variantId') id: string, @Body() b: any) {
    return this.vavSvc.store(+id, b.attribute_value_ids);
  }

  // DELETE /variant/:variantId/detach-attribute-value/:attributeValueId  [Admin]
  @UseGuards(JwtAuthGuard)
  @Delete('variant/:variantId/detach-attribute-value/:attributeValueId')
  detachAttributeValue(
    @Param('variantId') variantId: string,
    @Param('attributeValueId') avId: string,
  ) {
    return this.vavSvc.destroy(+variantId, +avId);
  }
}
