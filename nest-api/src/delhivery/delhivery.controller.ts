import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { DelhiveryService } from './delhivery.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller()
export class DelhiveryController {
  constructor(private svc: DelhiveryService) {}

  // PUBLIC
  @Post('delhivery/webhook') handleWebhook(@Body() b: any): Promise<any> { return this.svc.handleWebhook(b); }

  // AUTH PROTECTED (any user)
  @UseGuards(JwtAuthGuard) @Post('delhivery/check-serviceability')                  checkServiceability(@Body() b: any): Promise<any>                 { return this.svc.checkServiceability(b); }
  @UseGuards(JwtAuthGuard) @Post('delhivery/track-waybill')                         trackByWaybill(@Body() b: any): Promise<any>                      { return this.svc.trackByWaybill(b); }
  @UseGuards(JwtAuthGuard) @Get('orders/:orderId/delhivery-tracking')               trackByOrder(@Param('orderId') id: string): Promise<any>           { return this.svc.trackByOrder(id); }

  // ADMIN ONLY
  @UseGuards(JwtAuthGuard, AdminGuard) @Post('delhivery/orders/:orderId/create-shipment')  createShipment(@Param('orderId') id: string, @Body() b: any): Promise<any> { return this.svc.createShipment(id, b); }
  @UseGuards(JwtAuthGuard, AdminGuard) @Post('delhivery/bulk-create-shipments')             bulkCreateShipments(@Body() b: { orderIds: number[] }): Promise<any>       { return this.svc.bulkCreateShipments(b); }
  @UseGuards(JwtAuthGuard, AdminGuard) @Get('delhivery/orders/:orderId/sync-tracking')     syncTracking(@Param('orderId') id: string): Promise<any>                   { return this.svc.syncTracking(id); }
  @UseGuards(JwtAuthGuard, AdminGuard) @Get('delhivery/warehouses')                        getWarehouses(): Promise<any>                                              { return this.svc.getWarehouses(); }
}
