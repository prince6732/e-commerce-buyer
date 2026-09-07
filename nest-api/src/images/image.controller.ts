import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join, resolve } from 'path';
import * as path from 'path';
import { existsSync, mkdirSync, readdirSync, renameSync } from 'fs';
import { ImageService } from './image.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

const getStorageBaseDir = () => {
  const envPath = process.env.UPLOAD_PATH || process.env.SHARED_STORAGE_PATH;
  if (!envPath) return join(process.cwd(), '../zelton-storage/api/public/storage');
  return path.isAbsolute(envPath) ? envPath : resolve(process.cwd(), envPath);
};

const tempStorage = diskStorage({
  destination: (req, file, cb) => {
    const tempDir = join(getStorageBaseDir(), '_temp');
    if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${extname(file.originalname)}`);
  },
});

@Controller('images')
export class ImageController {
  constructor(private svc: ImageService) { }

  @Get('get-files/:directory')
  getFiles(@Param('directory') dir: string): Promise<any> {
    return this.svc.getFiles(dir);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: tempStorage,
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Query('directory') queryDir?: string,
    @Headers('x-directory') headerDir?: string,
  ): Promise<any> {
    const directory = body?.directory || queryDir || headerDir || 'products';
    const targetDir = join(getStorageBaseDir(), directory);

    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    let nextNum = 1;
    if (existsSync(targetDir)) {
      const files = readdirSync(targetDir);
      const nums = files
        .map((f: string) => parseInt(f.split('.')[0], 10))
        .filter((n: number) => !isNaN(n));
      if (nums.length > 0) nextNum = Math.max(...nums) + 1;
    }
    const finalFilename = String(nextNum).padStart(15, '0') + extname(file.originalname);
    const finalPath = join(targetDir, finalFilename);

    // Move file from temp to final target directory
    renameSync(file.path, finalPath);

    const url = `/storage/${directory}/${finalFilename}`;
    return {
      isSuccess: true,
      result: url,
      message: 'Image uploaded successfully.',
    };
  }

  @Post('upload/:directory')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dirParam = Array.isArray(req.params.directory) ? req.params.directory[0] : (req.params.directory ?? 'general');
          const dir = join(getStorageBaseDir(), dirParam);
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadToDir(@UploadedFile() file: Express.Multer.File, @Param('directory') directory: string): Promise<any> {
    const url = `/storage/${directory}/${file.filename}`;
    return Promise.resolve({ success: true, message: 'File uploaded successfully', url, filename: file.filename });
  }

  @Post('upload-multiple')
  @UseInterceptors(
    FilesInterceptor('images', 5, {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = join(getStorageBaseDir(), (req.query.directory as string) ?? 'general');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadMultiple(@UploadedFiles() files: Express.Multer.File[], @Body() body: any): Promise<any> {
    const directory = body.directory ?? 'general';
    const urls = files.map(f => `/storage/${directory}/${f.filename}`);
    return Promise.resolve({ success: true, message: `${files.length} files uploaded`, urls });
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete()
  @HttpCode(200)
  delete(@Body() b: any): Promise<any> {
    const targetPath = b.path ?? b.file_path;
    return this.svc.delete(targetPath);
  }
}
