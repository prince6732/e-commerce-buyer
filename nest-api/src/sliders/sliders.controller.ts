import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SlidersService } from './sliders.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller()
export class SlidersController {
  constructor(private svc: SlidersService) {}
  @Get('sliders')                              index(@Query() query: any): Promise<any>               { return this.svc.index(query); }
  @Get('get-sliders/:id')                      show(@Param('id') id: string): Promise<any>             { return this.svc.show(+id); }
  @Get('new-arrival-sliders')                  naIndex(@Query() query: any): Promise<any>             { return this.svc.naIndex(query); }
  @Get('new-arrival-sliders/:id')              naShow(@Param('id') id: string): Promise<any>           { return this.svc.naShow(+id); }

  @UseGuards(JwtAuthGuard) @Post('create-sliders')                     store(@Body() b: any): Promise<any>                                   { return this.svc.store(b); }
  @UseGuards(JwtAuthGuard) @Put('update-sliders/:id')                  update(@Param('id') id: string, @Body() b: any): Promise<any>         { return this.svc.update(+id, b); }
  @UseGuards(JwtAuthGuard) @Delete('delete-sliders/:id')               destroy(@Param('id') id: string): Promise<any>                        { return this.svc.destroy(+id); }
  @UseGuards(JwtAuthGuard) @Patch('sliders/:id/status')                changeStatus(@Param('id') id: string): Promise<any>                   { return this.svc.changeStatus(+id); }
  @UseGuards(JwtAuthGuard) @Post('order')                              updateOrder(@Body() b: any): Promise<any>                             { return this.svc.updateOrder(b); }

  @UseGuards(JwtAuthGuard) @Post('create-new-arrival-sliders')         naStore(@Body() b: any): Promise<any>                                 { return this.svc.naStore(b); }
  @UseGuards(JwtAuthGuard) @Put('update-new-arrival-sliders/:id')      naUpdate(@Param('id') id: string, @Body() b: any): Promise<any>       { return this.svc.naUpdate(+id, b); }
  @UseGuards(JwtAuthGuard) @Delete('delete-new-arrival-sliders/:id')   naDestroy(@Param('id') id: string): Promise<any>                      { return this.svc.naDestroy(+id); }
  @UseGuards(JwtAuthGuard) @Patch('new-arrival-sliders/:id/status')    naChangeStatus(@Param('id') id: string): Promise<any>                 { return this.svc.naChangeStatus(+id); }
  @UseGuards(JwtAuthGuard) @Post('new-arrival-sliders-order')          naUpdateOrder(@Body() b: any): Promise<any>                           { return this.svc.naUpdateOrder(b); }
}
