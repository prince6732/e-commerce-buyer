import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private svc: DashboardService) {}
  
  @Get('statistics')
  getStatistics(@Query() query: any) {
    return this.svc.getStatistics(query);
  }
}
