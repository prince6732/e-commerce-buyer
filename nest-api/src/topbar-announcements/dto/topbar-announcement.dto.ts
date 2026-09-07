import { IsNotEmpty, IsString, IsOptional, MaxLength, MinLength, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateTopbarAnnouncementDto {
  @IsNotEmpty({ message: 'Title is required' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(3, { message: 'Title must be at least 3 characters' })
  @MaxLength(255, { message: 'Title cannot exceed 255 characters' })
  title: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100, { message: 'Icon cannot exceed 100 characters' })
  icon?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(500, { message: 'Link URL cannot exceed 500 characters' })
  link_url?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'], { message: 'Status must be active or inactive' })
  status?: 'active' | 'inactive' = 'active';
}

export class UpdateTopbarAnnouncementDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(3, { message: 'Title must be at least 3 characters' })
  @MaxLength(255, { message: 'Title cannot exceed 255 characters' })
  title?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100, { message: 'Icon cannot exceed 100 characters' })
  icon?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(500, { message: 'Link URL cannot exceed 500 characters' })
  link_url?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'], { message: 'Status must be active or inactive' })
  status?: 'active' | 'inactive';
}

export class UpdateStatusDto {
  @IsOptional()
  @IsIn(['active', 'inactive'], { message: 'Status must be active or inactive' })
  status?: 'active' | 'inactive';
}
