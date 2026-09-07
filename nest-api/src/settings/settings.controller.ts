import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller()
export class SettingsController {
  constructor(private svc: SettingsService) {}
  @Get('settings')                             index()                                      { return this.svc.index(); }
  @Get('settings/:key')                        getByKey(@Param('key') key: string)          { return this.svc.getByKey(key); }

  @UseGuards(JwtAuthGuard) @Get('admin/settings/:key')   adminGetByKey(@Param('key') key: string) { return this.svc.getByKey(key); }
  @UseGuards(JwtAuthGuard) @Post('settings')              store(@Body() b: any)                    { return this.svc.store(b); }
  @UseGuards(JwtAuthGuard) @Put('update-settings/:setting') update(@Param('setting') setting: string, @Body() b: any) { return this.svc.update(setting, b); }
}
