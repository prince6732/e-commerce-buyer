import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Request,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join, resolve } from 'path';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

const getStorageBaseDir = () => {
  const envPath = process.env.SHARED_STORAGE_PATH || process.env.UPLOAD_PATH;
  return envPath ? resolve(process.cwd(), envPath) : join(process.cwd(), '../zelton-storage/api/public/storage');
};

const reviewUploadStorage = diskStorage({
  destination: (req, file, cb) => {
    const dir = join(getStorageBaseDir(), 'reviews');
    const { mkdirSync, existsSync } = require('fs');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${extname(file.originalname)}`);
  },
});

@Controller()
export class ReviewsController {
  constructor(private svc: ReviewsService) { }

  // ─── PUBLIC ───────────────────────────────────────────────────────────────
  @Get('products/:productId/reviews')
  index(@Param('productId') id: string, @Query() q: any): Promise<any> {
    return this.svc.index(id, q);
  }

  @Get('reviews/:id')
  show(@Param('id') id: string): Promise<any> {
    return this.svc.show(+id);
  }

  // ─── PROTECTED ────────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('reviews')
  @UseInterceptors(FilesInterceptor('images', 5, {
    storage: reviewUploadStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (!file.mimetype || file.mimetype.startsWith('image/')) cb(null, true);
      else cb(null, false);
    },
  }))
  store(
    @Request() req: any,
    @Body() b: any,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<any> {
    const imagePaths = (files ?? []).map(f => `/storage/reviews/${f.filename}`);
    return this.svc.store(req.user.id, b, imagePaths);
  }

  @UseGuards(JwtAuthGuard)
  @Put('reviews/:id')
  @Post('reviews/:id')
  @UseInterceptors(FilesInterceptor('images', 5, {
    storage: reviewUploadStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (!file.mimetype || file.mimetype.startsWith('image/')) cb(null, true);
      else cb(null, false);
    },
  }))
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() b: any,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<any> {
    const newImagePaths = (files ?? []).map(f => `/storage/reviews/${f.filename}`);
    return this.svc.update(req.user.id, +id, b, newImagePaths);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('reviews/:id')
  destroy(@Request() req: any, @Param('id') id: string): Promise<any> {
    return this.svc.destroy(req.user.id, +id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('reviews/:id/helpful')
  helpful(@Request() req: any, @Param('id') id: string): Promise<any> {
    return this.svc.toggleHelpful(req.user.id, +id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('products/:productId/my-review')
  myReview(@Request() req: any, @Param('productId') id: string): Promise<any> {
    return this.svc.getUserReview(req.user.id, id);
  }
}
