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
import { RtoService } from './rto.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { NdrActionDto, RtoQcDto, ProcessRtoRefundDto } from './dto/rto.dto';

@Controller('admin/rto')
@UseGuards(JwtAuthGuard, AdminGuard)
export class RtoController {
  constructor(private readonly rtoService: RtoService) {}

  @Get('analytics')
  async getRtoAnalytics(): Promise<any> {
    return this.rtoService.getRtoAnalytics();
  }

  @Get()
  async getAllRtoCases(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('ndrAging') ndrAging?: string,
  ): Promise<any> {
    return this.rtoService.getAllRtoCases({
      page,
      limit,
      status,
      search,
      ndrAging,
    });
  }

  @Get(':id')
  async getRtoCase(@Param('id', ParseIntPipe) id: number): Promise<any> {
    return this.rtoService.getRtoCaseById(id);
  }

  @Post(':id/ndr-action')
  async executeNdrAction(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Body() dto: NdrActionDto,
  ): Promise<any> {
    return this.rtoService.executeNdrAction(id, req.user, dto);
  }

  @Post(':id/mark-delivered')
  async markDelivered(@Param('id', ParseIntPipe) id: number, @Request() req: any): Promise<any> {
    return this.rtoService.markRtoDelivered(id, req.user);
  }

  @Post(':id/qc')
  async qualityCheck(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Body() dto: RtoQcDto,
  ): Promise<any> {
    return this.rtoService.qualityCheckRto(id, req.user, dto);
  }

  @Post(':id/refund')
  async processRefund(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Body() dto?: ProcessRtoRefundDto,
  ): Promise<any> {
    return this.rtoService.processRtoRefund(id, req.user, dto);
  }
}
