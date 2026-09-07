import { Controller, Get, Post, Put, Delete, Body, Param, Request, UseGuards } from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private svc: CartService) {}
  @Get()                  index(@Request() req: any)                                         { return this.svc.index(req.user.id); }
  @Get('count')           count(@Request() req: any)                                         { return this.svc.getCartCount(req.user.id); }
  @Post('add')            store(@Request() req: any, @Body() b: any)                         { return this.svc.store(req.user.id, b); }
  @Put(':id')             update(@Request() req: any, @Param('id') id: string, @Body() b: any) { return this.svc.update(req.user.id, +id, b); }
  @Delete(':id')          destroy(@Request() req: any, @Param('id') id: string)               { return this.svc.destroy(req.user.id, +id); }
  @Delete()               clear(@Request() req: any)                                          { return this.svc.clear(req.user.id); }
}
