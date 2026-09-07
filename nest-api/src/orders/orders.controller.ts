import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Request,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller()
export class OrdersController {
  constructor(private svc: OrdersService) {}

  // ─── PUBLIC delivery confirmation & tracking routes ───────────────────────
  @Get('confirm-delivery/:token')
  getByToken(@Param('token') t: string): Promise<any> {
    return this.svc.getOrderByToken(t);
  }

  @Post('confirm-delivery/:token')
  confirmDelivery(@Param('token') t: string): Promise<any> {
    return this.svc.confirmDelivery(t);
  }

  @Post('orders/public-track')
  publicTrackOrder(@Body() body: { identifier: string; email: string }): Promise<any> {
    return this.svc.publicTrackOrder(body?.identifier, body?.email);
  }

  // ─── USER PROTECTED ───────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('orders')
  index(@Request() req: any, @Query() q: any): Promise<any> {
    return this.svc.index(req.user.id, q);
  }

  @UseGuards(JwtAuthGuard)
  @Get('orders/:id/invoice')
  async downloadUserInvoice(
    @Request() req: any,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { filename, buffer } = await this.svc.getInvoicePdfBuffer(id, req.user.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @UseGuards(JwtAuthGuard)
  @Get('orders/:id')
  show(@Request() req: any, @Param('id') id: string): Promise<any> {
    return this.svc.show(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('orders/place-from-cart')
  placeFromCart(@Request() req: any, @Body() b: any): Promise<any> {
    return this.svc.placeOrderFromCart(req.user.id, b);
  }

  @UseGuards(JwtAuthGuard)
  @Post('orders/place-single-item')
  placeSingle(@Request() req: any, @Body() b: any): Promise<any> {
    return this.svc.placeSingleItemOrder(req.user.id, b);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('orders/:id/cancel')
  cancel(@Request() req: any, @Param('id') id: string): Promise<any> {
    return this.svc.cancelOrder(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('orders/:id/tracking')
  tracking(@Request() req: any, @Param('id') id: string): Promise<any> {
    return this.svc.getTracking(req.user.id, id);
  }

  // ─── ADMIN PROTECTED ──────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/orders')
  adminIndex(@Query() q: any): Promise<any> {
    return this.svc.adminIndex(q);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/orders/stats')
  adminStats(): Promise<any> {
    return this.svc.getOrderStats();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/orders/completed')
  completedOrders(@Query() q: any): Promise<any> {
    return this.svc.getCompletedOrders(q);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/orders/completed/:id')
  completedOrderDetails(@Param('id') id: string): Promise<any> {
    return this.svc.getCompletedOrderDetails(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/orders/cancelled')
  cancelledOrders(@Query() q: any): Promise<any> {
    return this.svc.getCancelledOrders(q);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/orders/:id/invoice')
  async downloadAdminInvoice(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { filename, buffer } = await this.svc.getInvoicePdfBuffer(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/orders/:id')
  adminShow(@Param('id') id: string): Promise<any> {
    return this.svc.adminShow(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('admin/orders/:id/status')
  adminUpdateStatus(@Param('id') id: string, @Body() b: any): Promise<any> {
    return this.svc.adminUpdateStatus(id, b);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/orders/bulk-accept')
  adminBulkAccept(@Body() b: { orderIds: number[] }): Promise<any> {
    return this.svc.bulkAcceptOrders(b);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/orders/bulk-cancel')
  adminBulkCancel(@Body() b: { orderIds: number[]; reason?: string }): Promise<any> {
    return this.svc.bulkCancelOrders(b);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/orders/bulk-create-shipments')
  adminBulkCreateShipments(@Body() b: { orderIds: number[] }): Promise<any> {
    return this.svc.bulkCreateShipments(b);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/gst-report')
  getGSTReport(@Query() q: any): Promise<any> {
    return this.svc.getGSTReportData(q);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/gst-report/download')
  async downloadGSTReport(@Query() q: any, @Res() res: Response): Promise<void> {
    const buffer = await this.svc.generateGSTReportExcel(q);
    const filename = `GST_Sales_Report_${q.from_date || 'all'}_to_${q.to_date || 'all'}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }
}
