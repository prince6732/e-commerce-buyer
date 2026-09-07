import { Module } from '@nestjs/common';
import { UsersAdminController } from './users/users-admin.controller';
import { UsersAdminService } from './users/users-admin.service';
import { ContactController } from './contact/contact.controller';
import { ContactService } from './contact/contact.service';

@Module({
  controllers: [UsersAdminController, ContactController],
  providers: [UsersAdminService, ContactService],
})
export class AdminModule {}
