import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ImageService {
  private readonly uploadDir: string;

  constructor(private config: ConfigService) {
    const envPath = this.config.get<string>('UPLOAD_PATH') || this.config.get<string>('SHARED_STORAGE_PATH');
    this.uploadDir = envPath
      ? (path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath))
      : path.join(process.cwd(), '../zelton-storage/api/public/storage');
    // Ensure base upload directory exists
    if (!fs.existsSync(this.uploadDir)) fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  getUploadDir(directory = 'general'): string {
    const dir = path.join(this.uploadDir, directory);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  getFileUrl(directory: string, filename: string): string {
    return `/storage/${directory}/${filename}`;
  }

  async getFiles(directory: string): Promise<any> {
    const dirPath = path.join(this.uploadDir, directory);
    if (!fs.existsSync(dirPath)) return [];

    const files = fs.readdirSync(dirPath).map(f => `/storage/${directory}/${f}`);
    return files;
  }

  async saveUploadedFile(file: Express.Multer.File, directory = 'general'): Promise<string> {
    return this.getFileUrl(directory, file.filename);
  }

  async delete(filePath: string): Promise<any> {
    if (!filePath) {
      throw new BadRequestException({ isSuccess: false, message: 'Path is required.' });
    }

    const cleanPath = filePath.replace(/^\/storage\//, '').replace(/^\/uploads\//, '');
    const fullPath = path.join(this.uploadDir, cleanPath);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return { isSuccess: true, message: 'Image deleted successfully.' };
    }

    throw new NotFoundException({ isSuccess: false, message: 'File not found.' });
  }

  async deleteByUrl(url: string): Promise<any> {
    return this.delete(url);
  }
}
