import { Controller, Post, Get, Body, Request, UseGuards } from '@nestjs/common';
import { LikesService } from './likes.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('likes')
export class LikesController {
  constructor(private svc: LikesService) {}
  @Post('toggle')      toggle(@Request() req: any, @Body() b: any)          { return this.svc.toggle(req.user.id, b.product_id); }
  @Get()               getUserLikes(@Request() req: any)                     { return this.svc.getUserLikes(req.user.id); }
  @Post('check')       check(@Request() req: any, @Body() b: any)           { return this.svc.checkLikeStatus(req.user.id, b.product_id); }
  @Post('bulk-check')  bulkCheck(@Request() req: any, @Body() b: any)       { return this.svc.getProductsLikesStatus(req.user.id, b.product_ids); }
}
