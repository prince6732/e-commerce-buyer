import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller()
export class CategoriesController {
  constructor(private svc: CategoriesService) {}

  // === PUBLIC CATEGORY ROUTES ===
  @Get('categories')                        index(@Query() q: any): Promise<any>                { return this.svc.index(q); }
  @Get('categories-with-products')          indexWithProducts(): Promise<any>                   { return this.svc.indexWithProducts(); }
  @Get('subcategories-by-parent')           subcategoriesByParent(@Query() q: any): Promise<any> { return this.svc.subcategoriesWithProducts(q); }
  @Get('get-category/:id')                  show(@Param('id') id: string, @Query() q: any): Promise<any> { return this.svc.show(id, q); }
  @Get('get-category-for-product/:id')      showForProduct(@Param('id') id: string, @Query() q: any): Promise<any> { return this.svc.getCategoryByIdForProduct(id, q); }
  @Get('subcategories-with-products')       subcatWithProducts(@Query() q: any): Promise<any>   { return this.svc.getSubcategoriesWithProductCounts(q); }

  // === PUBLIC SUBCATEGORY ROUTES ===
  // GET /subcategories?parent_id=X&search=Y&include_inactive=true
  @Get('subcategories')                     subcatIndex(@Query() q: any): Promise<any>          { return this.svc.subcategoryIndex(q); }
  @Get('get-subcategory/:id')               subcatShow(@Param('id') id: string, @Query() q: any): Promise<any> { return this.svc.subcategoryShow(id, q); }

  // === ADMIN: CATEGORY ROUTES ===
  @UseGuards(JwtAuthGuard)
  @Post('create-categories')
  store(@Body() body: any)                                                                      { return this.svc.store(body); }

  @UseGuards(JwtAuthGuard)
  @Put('update-category/:id')
  update(@Param('id') id: string, @Body() body: any)                                           { return this.svc.update(+id, body); }

  @UseGuards(JwtAuthGuard)
  @Delete('delete-category/:id')
  destroy(@Param('id') id: string)                                                              { return this.svc.destroy(+id); }

  @UseGuards(JwtAuthGuard)
  @Patch('category/:id/status')
  changeStatus(@Param('id') id: string)                                                         { return this.svc.changeStatus(+id); }

  // === ADMIN: SUBCATEGORY ROUTES ===
  @UseGuards(JwtAuthGuard)
  @Post('create-subcategory')
  storeSubcat(@Body() body: any)                                                                { return this.svc.storeSubcategory(body); }

  @UseGuards(JwtAuthGuard)
  @Put('update-subcategory/:id')
  updateSubcat(@Param('id') id: string, @Body() body: any)                                     { return this.svc.updateSubcategory(+id, body); }

  @UseGuards(JwtAuthGuard)
  @Delete('delete-subcategory/:id')
  destroySubcat(@Param('id') id: string)                                                       { return this.svc.destroySubcategory(+id); }
}
