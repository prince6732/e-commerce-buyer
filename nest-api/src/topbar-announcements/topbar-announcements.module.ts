import { Module } from '@nestjs/common';
import { TopbarAnnouncementsController } from './topbar-announcements.controller';
import { TopbarAnnouncementsService } from './topbar-announcements.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [TopbarAnnouncementsController],
  providers: [TopbarAnnouncementsService],
  exports: [TopbarAnnouncementsService],
})
export class TopbarAnnouncementsModule {}
