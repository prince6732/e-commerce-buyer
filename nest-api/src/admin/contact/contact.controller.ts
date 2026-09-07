import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ContactService } from './contact.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';

@Controller()
export class ContactController {
  constructor(private svc: ContactService) {}

  // PUBLIC
  @Post('contact-us')
  store(@Body() b: any): Promise<any> {
    return this.svc.store(b);
  }

  // ADMIN
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/contact-messages')
  index(@Query() q: any): Promise<any> {
    return this.svc.index(q);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/contact-messages/:id')
  show(@Param('id') id: string): Promise<any> {
    return this.svc.show(+id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('admin/contact-messages/:id/mark-read')
  markRead(@Param('id') id: string): Promise<any> {
    return this.svc.markAsRead(+id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('admin/contact-messages/:id')
  destroy(@Param('id') id: string): Promise<any> {
    return this.svc.destroy(+id);
  }
}
