import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profile/profile.module';
import { CategoriesModule } from './categories/categories.module';
import { BrandsModule } from './brands/brands.module';
import { AttributesModule } from './attributes/attributes.module';
import { ProductsModule } from './products/products.module';
import { SlidersModule } from './sliders/sliders.module';
import { SettingsModule } from './settings/settings.module';
import { CartModule } from './cart/cart.module';
import { LikesModule } from './likes/likes.module';
import { ReviewsModule } from './reviews/reviews.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentModule } from './payment/payment.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AdminModule } from './admin/admin.module';
import { DelhiveryModule } from './delhivery/delhivery.module';
import { ImageModule } from './images/image.module';
import { NotificationsModule } from './notifications/notifications.module';
import { LocationsModule } from './locations/locations.module';
import { TopbarAnnouncementsModule } from './topbar-announcements/topbar-announcements.module';
import { AuditModule } from './audit/audit.module';
import { InventoryModule } from './inventory/inventory.module';
import { ReturnsModule } from './returns/returns.module';
import { RtoModule } from './rto/rto.module';

// Extra route for change-password at root level (not under /profile)
import { ProfileService } from './profile/profile.service';
import { Controller, Put, Body, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Controller()
class ChangePasswordController {
  constructor(private profileService: ProfileService) { }
  @UseGuards(JwtAuthGuard)
  @Put('change-password')
  changePassword(@Request() req: any, @Body() body: any) {
    return this.profileService.changePassword(req.user.id, body);
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: process.env.UPLOAD_PATH
        ? (require('path').isAbsolute(process.env.UPLOAD_PATH)
          ? process.env.UPLOAD_PATH
          : join(process.cwd(), process.env.UPLOAD_PATH))
        : join(process.cwd(), '../zelton-storage/api/public/storage'),
      serveRoot: '/storage',
    }),
    ServeStaticModule.forRoot({
      rootPath: process.env.UPLOAD_PATH
        ? (require('path').isAbsolute(process.env.UPLOAD_PATH)
          ? process.env.UPLOAD_PATH
          : join(process.cwd(), process.env.UPLOAD_PATH))
        : join(process.cwd(), '../zelton-storage/api/public/storage'),
      serveRoot: '/uploads',
    }),
    DatabaseModule,
    MailModule,
    AuthModule,
    ProfileModule,
    CategoriesModule,
    BrandsModule,
    AttributesModule,
    ProductsModule,
    SlidersModule,
    SettingsModule,
    CartModule,
    LikesModule,
    ReviewsModule,
    OrdersModule,
    PaymentModule,
    DashboardModule,
    AdminModule,
    DelhiveryModule,
    ImageModule,
    NotificationsModule,
    LocationsModule,
    TopbarAnnouncementsModule,
    AuditModule,
    InventoryModule,
    ReturnsModule,
    RtoModule,
  ],
  controllers: [AppController, ChangePasswordController],
  providers: [AppService, ProfileService],
})
export class AppModule { }
