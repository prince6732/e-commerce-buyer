import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { ReturnEligibilityService } from './return-eligibility.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import {
  RequestReturnDto,
  ApproveReturnDto,
  RejectReturnDto,
  ReturnQualityCheckDto,
  ProcessRefundDto,
} from './dto/return.dto';

@Controller()
export class ReturnsController {
  constructor(
    private readonly returnsService: ReturnsService,
    private readonly eligibilityService: ReturnEligibilityService,
  ) {}

  // ─── Customer Endpoints ───────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('orders/:orderId/return-eligibility')
  async checkEligibility(@Param('orderId') orderId: string, @Request() req: any): Promise<any> {
    return this.eligibilityService.checkEligibility(orderId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('returns/request')
  async requestReturn(@Request() req: any, @Body() dto: RequestReturnDto): Promise<any> {
    return this.returnsService.requestReturn(req.user.id || req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('returns/my')
  async getMyReturns(
    @Request() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ): Promise<any> {
    return this.returnsService.getMyReturns(req.user.id || req.user.sub, {
      page,
      limit,
      status,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('returns/:identifier')
  async getReturnDetails(@Param('identifier') identifier: string, @Request() req: any): Promise<any> {
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
    return this.returnsService.getReturnByIdentifier(identifier, req.user.id || req.user.sub, isAdmin);
  }

  @UseGuards(JwtAuthGuard)
  @Post('returns/:id/cancel')
  async cancelReturn(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Body('reason') reason?: string,
  ): Promise<any> {
    return this.returnsService.cancelReturn(id, req.user.id || req.user.sub, reason);
  }

  // ─── Admin Endpoints ──────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/returns')
  async getAllReturns(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('returnType') returnType?: string,
    @Query('search') search?: string,
  ): Promise<any> {
    return this.returnsService.getAllReturns({
      page,
      limit,
      status,
      returnType,
      search,
    });
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/returns/:identifier')
  async getAdminReturnDetails(@Param('identifier') identifier: string): Promise<any> {
    return this.returnsService.getReturnByIdentifier(identifier, undefined, true);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/returns/:id/approve')
  async approveReturn(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Body() dto?: ApproveReturnDto,
  ): Promise<any> {
    return this.returnsService.approveReturn(id, req.user, dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/returns/:id/reject')
  async rejectReturn(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Body() dto: RejectReturnDto,
  ): Promise<any> {
    return this.returnsService.rejectReturn(id, req.user, dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/returns/:id/schedule-pickup')
  async scheduleReversePickup(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Body('pickup_date') pickupDate?: string,
  ): Promise<any> {
    return this.returnsService.scheduleReversePickup(id, req.user, pickupDate);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/returns/:id/mark-received')
  async markReceived(@Param('id', ParseIntPipe) id: number, @Request() req: any): Promise<any> {
    return this.returnsService.markReceivedAtWarehouse(id, req.user);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/returns/:id/qc')
  async qualityCheck(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Body() dto: ReturnQualityCheckDto,
  ): Promise<any> {
    return this.returnsService.qualityCheck(id, req.user, dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/returns/:id/refund')
  async processRefund(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Body() dto: ProcessRefundDto,
  ): Promise<any> {
    return this.returnsService.triggerRefund(id, req.user, dto);
  }
}
