import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { NotificationsService, CreateNotificationDto, UpdatePreferencesDto, UpdateAdminPreferencesDto } from './notifications.service';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  private extractUserFromReq(req: Request): { userId?: number; role?: string } | null {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const secret = process.env.JWT_SECRET || 'secret';
        const decoded: any = jwt.verify(token, secret);
        return {
          userId: Number(decoded.sub || decoded.id),
          role: decoded.role || 'User',
        };
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  @Get()
  async getNotifications(
    @Req() req: any,
    @Query('recipient_group') recipientGroup?: string,
    @Query('category') category?: string,
    @Query('priority') priority?: string,
    @Query('is_read') isReadStr?: string,
    @Query('search') search?: string,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ) {
    const userInfo = this.extractUserFromReq(req);
    
    // Logged out / guest user -> NEVER return private customer or admin notifications
    if (!userInfo?.userId) {
      return {
        notifications: [],
        unreadCount: 0,
        page: pageStr ? parseInt(pageStr, 10) : 1,
        limit: limitStr ? parseInt(limitStr, 10) : 10,
        total: 0,
        hasNextPage: false,
      };
    }

    const userRole = userInfo.role;
    const isAdmin = ['Admin', 'Manager', 'superadmin', 'admin'].includes(userRole || '');
    const group = recipientGroup || (isAdmin ? 'admin' : 'customer');

    let isRead: boolean | undefined = undefined;
    if (isReadStr === 'true') isRead = true;
    if (isReadStr === 'false') isRead = false;

    return this.notificationsService.getNotifications({
      userId: isAdmin ? undefined : userInfo.userId, // Non-admins ONLY see their own notifications
      recipientGroup: group,
      category,
      priority,
      isRead,
      search,
      page: pageStr ? parseInt(pageStr, 10) : 1,
      limit: limitStr ? parseInt(limitStr, 10) : 10,
      offset: offsetStr ? parseInt(offsetStr, 10) : undefined,
    });
  }

  @Get('unread-count')
  async getUnreadCount(
    @Req() req: any,
    @Query('recipient_group') recipientGroup?: string,
  ) {
    const userInfo = this.extractUserFromReq(req);
    
    // Logged out / guest user -> 0 unread notifications
    if (!userInfo?.userId) {
      return { unreadCount: 0 };
    }

    const userRole = userInfo.role;
    const isAdmin = ['Admin', 'Manager', 'superadmin', 'admin'].includes(userRole || '');
    const group = recipientGroup || (isAdmin ? 'admin' : 'customer');

    return this.notificationsService.getUnreadCount({
      userId: isAdmin ? undefined : userInfo.userId,
      recipientGroup: group,
    });
  }

  @Get('preferences')
  async getPreferences(@Req() req: any) {
    const userInfo = this.extractUserFromReq(req);
    if (!userInfo?.userId) {
      throw new UnauthorizedException('Authentication required to view notification preferences');
    }
    return this.notificationsService.getPreferences(userInfo.userId);
  }

  @Patch('preferences')
  async updatePreferences(@Req() req: any, @Body() dto: UpdatePreferencesDto) {
    const userInfo = this.extractUserFromReq(req);
    if (!userInfo?.userId) {
      throw new UnauthorizedException('Authentication required to update notification preferences');
    }
    return this.notificationsService.updatePreferences(userInfo.userId, dto);
  }

  @Get('admin/preferences')
  async getAdminPreferences(@Req() req: any) {
    const userInfo = this.extractUserFromReq(req);
    if (!userInfo?.userId || !['Admin', 'Manager', 'superadmin', 'admin'].includes(userInfo.role || '')) {
      throw new UnauthorizedException('Super Admin access required for admin notification preferences');
    }
    return this.notificationsService.getAdminPreferences(userInfo.userId);
  }

  @Patch('admin/preferences')
  async updateAdminPreferences(@Req() req: any, @Body() dto: UpdateAdminPreferencesDto) {
    const userInfo = this.extractUserFromReq(req);
    if (!userInfo?.userId || !['Admin', 'Manager', 'superadmin', 'admin'].includes(userInfo.role || '')) {
      throw new UnauthorizedException('Super Admin access required for admin notification preferences');
    }
    return this.notificationsService.updateAdminPreferences(userInfo.userId, dto);
  }

  @Patch(':id/read')
  async markAsRead(@Req() req: any, @Param('id') id: string) {
    const userInfo = this.extractUserFromReq(req);
    const isAdmin = ['Admin', 'Manager', 'superadmin', 'admin'].includes(userInfo?.role || '');
    return this.notificationsService.markAsRead(parseInt(id, 10), isAdmin ? undefined : userInfo?.userId);
  }

  @Patch('read-all')
  async markAllAsRead(
    @Req() req: any,
    @Query('recipient_group') recipientGroup?: string,
  ) {
    const userInfo = this.extractUserFromReq(req);
    const isAdmin = ['Admin', 'Manager', 'superadmin', 'admin'].includes(userInfo?.role || '');
    return this.notificationsService.markAllAsRead({
      userId: isAdmin ? undefined : userInfo?.userId,
      recipientGroup: recipientGroup || (isAdmin ? 'admin' : 'customer'),
    });
  }

  @Delete(':id')
  async deleteNotification(@Req() req: any, @Param('id') id: string) {
    const userInfo = this.extractUserFromReq(req);
    const isAdmin = ['Admin', 'Manager', 'superadmin', 'admin'].includes(userInfo?.role || '');
    return this.notificationsService.deleteNotification(parseInt(id, 10), isAdmin ? undefined : userInfo?.userId);
  }

  @Post('bulk-delete')
  async bulkDeleteNotifications(@Req() req: any, @Body() body: { ids?: number[]; allRead?: boolean }) {
    const userInfo = this.extractUserFromReq(req);
    const isAdmin = ['Admin', 'Manager', 'superadmin', 'admin'].includes(userInfo?.role || '');
    return this.notificationsService.bulkDeleteNotifications(isAdmin ? undefined : userInfo?.userId, body);
  }

  @Post('admin/system-error')
  async reportSystemError(@Body() body: { title: string; message: string; type?: string; priority?: string }) {
    return this.notificationsService.createAndEmitNotification({
      recipientGroup: 'admin',
      title: body.title || '🚨 Critical System Error',
      message: body.message,
      type: body.type || 'SYSTEM_ERROR',
      priority: (body.priority as any) || 'CRITICAL',
      link: '/dashboard/settings',
    });
  }

  @Post('broadcast')
  async broadcastNotification(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.createAndEmitNotification(dto);
  }
}
