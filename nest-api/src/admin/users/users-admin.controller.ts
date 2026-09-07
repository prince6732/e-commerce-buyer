import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { UsersAdminService } from './users-admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/users')
export class UsersAdminController {
  constructor(private svc: UsersAdminService) {}

  @Get()
  index(@Query() q: any): Promise<any> {
    return this.svc.index(q);
  }

  @Get('statistics')
  stats(): Promise<any> {
    return this.svc.getStatistics();
  }

  @Get(':id')
  show(@Param('id') id: string): Promise<any> {
    return this.svc.show(id);
  }

  @Post(':id/block')
  block(@Param('id') id: string): Promise<any> {
    return this.svc.blockUser(id);
  }

  @Post(':id/unblock')
  unblock(@Param('id') id: string): Promise<any> {
    return this.svc.unblockUser(id);
  }

  @Post(':id/toggle-status')
  toggle(@Param('id') id: string): Promise<any> {
    return this.svc.toggleStatus(id);
  }
}
