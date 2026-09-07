import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join, resolve } from 'path';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

const getStorageBaseDir = () => {
  const envPath = process.env.SHARED_STORAGE_PATH || process.env.UPLOAD_PATH;
  return envPath ? resolve(process.cwd(), envPath) : join(process.cwd(), '../zelton-storage/api/public/storage');
};

const profilePicStorage = diskStorage({
  destination: (req, file, cb) => {
    const dir = join(getStorageBaseDir(), 'profile-pictures');
    const { mkdirSync, existsSync } = require('fs');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${extname(file.originalname)}`);
  },
});

@UseGuards(JwtAuthGuard)
@Controller()
export class ProfileController {
  constructor(private profileService: ProfileService) { }

  @Get('profile')
  show(@Request() req: any): Promise<any> {
    return this.profileService.show(req.user.id);
  }

  @Put('profile')
  update(@Request() req: any, @Body() body: any): Promise<any> {
    return this.profileService.update(req.user.id, body);
  }

  @Put('change-password')
  changePassword(@Request() req: any, @Body() body: any): Promise<any> {
    return this.profileService.changePassword(req.user.id, body);
  }

  @Post('profile/upload-picture')
  @UseInterceptors(
    FileInterceptor('profile_picture', {
      storage: profilePicStorage,
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
      fileFilter: (req, file, cb) => {
        if (file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) cb(null, true);
        else cb(null, false);
      },
    }),
  )
  uploadPicture(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ): Promise<any> {
    const imagePath = file
      ? `/storage/profile-pictures/${file.filename}`
      : (body.image_url ?? body.profile_picture);
    return this.profileService.uploadProfilePicture(req.user.id, imagePath);
  }

  @Delete('profile/delete-picture')
  deletePicture(@Request() req: any): Promise<any> {
    return this.profileService.deleteProfilePicture(req.user.id);
  }
}
