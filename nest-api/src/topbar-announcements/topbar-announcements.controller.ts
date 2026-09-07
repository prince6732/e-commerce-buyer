import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { TopbarAnnouncementsService } from './topbar-announcements.service';
import {
  CreateTopbarAnnouncementDto,
  UpdateTopbarAnnouncementDto,
  UpdateStatusDto,
} from './dto/topbar-announcement.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller()
export class TopbarAnnouncementsController {
  constructor(private readonly service: TopbarAnnouncementsService) {}

  // ==========================================
  // 1. PUBLIC MARKETING ENDPOINTS
  // ==========================================
  /**
   * GET /topbar-announcements
   * Public endpoint for the marketing application.
   * Returns ONLY active announcements.
   */
  @Get('topbar-announcements')
  getActiveAnnouncements() {
    return this.service.getActiveAnnouncements();
  }

  // ==========================================
  // 2. ADMIN DASHBOARD ENDPOINTS
  // ==========================================
  /**
   * GET /admin/topbar-announcements
   * Admin endpoint to fetch all announcements with filters.
   */
  @UseGuards(JwtAuthGuard)
  @Get('admin/topbar-announcements')
  getAdminAnnouncements(@Query() query: any) {
    return this.service.getAdminAnnouncements(query);
  }

  /**
   * GET /admin/topbar-announcements/:id
   */
  @UseGuards(JwtAuthGuard)
  @Get('admin/topbar-announcements/:id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.service.getById(id);
  }

  /**
   * POST /admin/topbar-announcements
   */
  @UseGuards(JwtAuthGuard)
  @Post('admin/topbar-announcements')
  create(@Body() dto: CreateTopbarAnnouncementDto) {
    return this.service.create(dto);
  }

  /**
   * PUT /admin/topbar-announcements/:id
   */
  @UseGuards(JwtAuthGuard)
  @Put('admin/topbar-announcements/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTopbarAnnouncementDto,
  ) {
    return this.service.update(id, dto);
  }

  /**
   * PATCH /admin/topbar-announcements/:id
   */
  @UseGuards(JwtAuthGuard)
  @Patch('admin/topbar-announcements/:id')
  patch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTopbarAnnouncementDto,
  ) {
    return this.service.update(id, dto);
  }

  /**
   * DELETE /admin/topbar-announcements/:id
   */
  @UseGuards(JwtAuthGuard)
  @Delete('admin/topbar-announcements/:id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.service.delete(id);
  }

  /**
   * PATCH /admin/topbar-announcements/:id/status
   */
  @UseGuards(JwtAuthGuard)
  @Patch('admin/topbar-announcements/:id/status')
  toggleStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto?: UpdateStatusDto,
  ) {
    return this.service.toggleStatus(id, dto);
  }
}
