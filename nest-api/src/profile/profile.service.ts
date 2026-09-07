import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { DRIZZLE } from '../database/database.provider';
import type { DrizzleDB } from '../database/database.provider';
import { users } from '../database/schema';

@Injectable()
export class ProfileService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async show(userId: number): Promise<any> {
    const user = await this.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw new NotFoundException('User not found');
    return {
      success: true,
      message: 'Profile retrieved successfully.',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone_number: user.phoneNumber,
          address: user.address,
          profile_picture: user.profilePicture,
          status: user.status,
          role: user.role ?? 'User',
          email_verified_at: user.emailVerifiedAt,
          is_verified: user.isVerified,
          created_at: user.createdAt,
          updated_at: user.updatedAt,
        },
      },
    };
  }

  async update(userId: number, body: { name?: string; email?: string; phone_number?: string; address?: string }): Promise<any> {
    if (body.email) {
      const existing = await this.db.query.users.findFirst({ where: eq(users.email, body.email) });
      if (existing && existing.id !== userId) {
        throw new BadRequestException('Email is already taken');
      }
    }

    await this.db
      .update(users)
      .set({
        name: body.name,
        ...(body.email ? { email: body.email } : {}),
        phoneNumber: body.phone_number,
        address: body.address,
      })
      .where(eq(users.id, userId));

    const updated = await this.show(userId);
    return {
      success: true,
      message: 'Profile updated successfully.',
      data: updated.data,
    };
  }

  async changePassword(
    userId: number,
    body: {
      current_password?: string;
      new_password?: string;
      password?: string;
      new_password_confirmation?: string;
      password_confirmation?: string;
    },
  ): Promise<any> {
    const currentPassword = body.current_password;
    const newPassword = body.new_password ?? body.password;
    const confirmation = body.new_password_confirmation ?? body.password_confirmation;

    if (!currentPassword) {
      throw new HttpException(
        {
          success: false,
          message: 'Current password is required.',
          errors: { current_password: ['Current password is required.'] },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (!newPassword) {
      throw new HttpException(
        {
          success: false,
          message: 'New password is required.',
          errors: { new_password: ['New password is required.'] },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (newPassword.length < 8) {
      throw new HttpException(
        {
          success: false,
          message: 'New password must be at least 8 characters.',
          errors: { new_password: ['New password must be at least 8 characters.'] },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (confirmation && newPassword !== confirmation) {
      throw new HttpException(
        {
          success: false,
          message: 'Password confirmation does not match.',
          errors: { new_password_confirmation: ['Password confirmation does not match.'] },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const user = await this.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw new NotFoundException('User not found');

    if (!user.password) {
      throw new HttpException(
        {
          success: false,
          message: 'Your account was registered via Google Sign-In and does not have a local password set.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      throw new HttpException(
        {
          success: false,
          message: 'The current password you entered is incorrect.',
          errors: {
            current_password: ['The current password you entered is incorrect.'],
          },
        },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await this.db.update(users).set({ password: hashed }).where(eq(users.id, userId));

    return {
      success: true,
      message: 'Password updated successfully.',
    };
  }

  async uploadProfilePicture(userId: number, imageUrl: string) {
    if (!imageUrl) {
      throw new BadRequestException('No profile picture provided');
    }

    await this.db.update(users).set({ profilePicture: imageUrl }).where(eq(users.id, userId));

    return {
      success: true,
      message: 'Profile picture updated successfully.',
      data: {
        profile_picture_url: imageUrl,
      },
    };
  }

  async deleteProfilePicture(userId: number) {
    await this.db.update(users).set({ profilePicture: null }).where(eq(users.id, userId));

    return {
      success: true,
      message: 'Profile picture deleted successfully.',
    };
  }
}
