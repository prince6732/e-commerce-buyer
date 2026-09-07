import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BrandsService } from './brands.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller()
export class BrandsController {
  constructor(private svc: BrandsService) {}

  @Get('brands')
  index(@Query() query: any): Promise<any> {
    return this.svc.index(query);
  }

  @Get('brands/:id')
  show(@Param('id') id: string): Promise<any> {
    return this.svc.show(id);
  }

  @Get('get-brand/:id')
  showAlias(@Param('id') id: string): Promise<any> {
    return this.svc.show(id);
  }

  @Get('brands/:id/products')
  getProducts(@Param('id') id: string, @Query() q: any): Promise<any> {
    return this.svc.getProducts(id, q);
  }

  @UseGuards(JwtAuthGuard)
  @Post('create-brand')
  store(@Body() b: any): Promise<any> {
    return this.svc.store(b);
  }

  @UseGuards(JwtAuthGuard)
  @Put('update-brand/:id')
  update(@Param('id') id: string, @Body() b: any): Promise<any> {
    return this.svc.update(+id, b);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('delete-brand/:id')
  destroy(@Param('id') id: string): Promise<any> {
    return this.svc.destroy(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('brand/:id/status')
  changeStatus(@Param('id') id: string): Promise<any> {
    return this.svc.changeStatus(+id);
  }
}
