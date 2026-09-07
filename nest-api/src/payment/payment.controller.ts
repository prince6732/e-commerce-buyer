import { Controller, Post, Get, Body, Request, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller()
export class PaymentController {
  constructor(private svc: PaymentService) {}

  @Get('test-cashfree')
  testCredentials(): Promise<any> {
    return this.svc.testCredentials();
  }

  @UseGuards(JwtAuthGuard)
  @Post('payment/initiate')
  initiate(@Request() req: any, @Body() b: any): Promise<any> {
    return this.svc.initiatePayment(req.user.id, req.user, b);
  }

  @UseGuards(JwtAuthGuard)
  @Post('payment/verify')
  verify(@Request() req: any, @Body() b: any): Promise<any> {
    return this.svc.verifyPayment(b);
  }
}
