import {
  Injectable,
  Inject,
  HttpException,
  HttpStatus,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { eq, and } from 'drizzle-orm';
import { OAuth2Client } from 'google-auth-library';
import { DRIZZLE } from '../database/database.provider';
import type { DrizzleDB } from '../database/database.provider';
import { users, passwordResetTokens } from '../database/schema';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client;

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private jwtService: JwtService,
    private mailService: MailService,
    private config: ConfigService,
    private notificationsService: NotificationsService,
  ) {
    this.googleClient = new OAuth2Client(
      this.config.get<string>('GOOGLE_CLIENT_ID'),
    );
  }

  private generateOtp(): string {
    return String(Math.floor(100000 + Math.random() * 900000)).padStart(6, '0');
  }

  private signToken(user: any): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role ?? 'User',
    });
  }

  async register(body: {
    name?: string;
    email?: string;
    password?: string;
    password_confirmation?: string;
    phone_number?: string;
  }): Promise<any> {
    if (!body.email) {
      throw new HttpException(
        {
          message: 'The email field is required.',
          errors: { email: ['The email field is required.'] },
        },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    if (!body.name) {
      throw new HttpException(
        {
          message: 'The name field is required.',
          errors: { name: ['The name field is required.'] },
        },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    if (!/^[a-zA-Z\s]+$/.test(body.name.trim())) {
      throw new HttpException(
        {
          message: 'The name field can only contain letters and spaces.',
          errors: { name: ['The name field can only contain letters and spaces.'] },
        },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    if (!body.password) {
      throw new HttpException(
        {
          message: 'The password field is required.',
          errors: { password: ['The password field is required.'] },
        },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    if (body.password.length < 8) {
      throw new HttpException(
        {
          message: 'The password field must be at least 8 characters.',
          errors: { password: ['The password field must be at least 8 characters.'] },
        },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    if (body.password_confirmation && body.password !== body.password_confirmation) {
      throw new HttpException(
        {
          message: 'The password field confirmation does not match.',
          errors: { password: ['The password field confirmation does not match.'] },
        },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const existing = await this.db.query.users.findFirst({
      where: eq(users.email, body.email),
    });

    if (existing) {
      if (existing.googleId) {
        throw new HttpException(
          {
            message:
              'This email is already registered via Google Sign-In. Please use Google Login to access your account.',
            is_google_user: true,
          },
          HttpStatus.UNPROCESSABLE_ENTITY, // 422
        );
      }
      throw new HttpException(
        {
          message: 'The email has already been taken.',
          errors: { email: ['The email has already been taken.'] },
        },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const hashedPassword = await bcrypt.hash(body.password, 12);
    const otp = this.generateOtp();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.db
      .insert(users)
      .values({
        name: body.name,
        email: body.email,
        password: hashedPassword,
        phoneNumber: body.phone_number ?? null,
        otp,
        otpExpiresAt,
        emailVerifiedAt: null,
        isVerified: 'false',
        status: true,
        role: 'User',
      });

    try {
      await this.mailService.sendOtp(body.email, body.name, otp);
    } catch (err) {
      this.logger.error(`Error sending OTP email: ${err.message}`);
      return {
        message:
          'Registration successful but email could not be sent. Please contact support.',
        user: { email: body.email, name: body.name },
      };
    }

    return {
      message:
        'Registration successful! Please check your email for the OTP verification code.',
      user: { email: body.email, name: body.name },
    };
  }

  async verify(email: string, code: string): Promise<any> {
    if (!email || !code) {
      throw new HttpException(
        { message: 'Invalid verification code' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const user = await this.db.query.users.findFirst({
      where: and(
        eq(users.email, email),
        eq(users.emailVerificationCode, code),
      ),
    });

    if (!user) {
      throw new HttpException(
        { message: 'Invalid verification code' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    await this.db
      .update(users)
      .set({
        emailVerifiedAt: new Date(),
        emailVerificationCode: null,
        isVerified: 'true',
      })
      .where(eq(users.id, user.id));

    return { message: 'Email verified successfully' };
  }

  async verifyOTP(email: string, otp: string): Promise<any> {
    if (!email) {
      throw new HttpException(
        {
          message: 'The email field is required.',
          errors: { email: ['The email field is required.'] },
        },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    if (!otp) {
      throw new HttpException(
        {
          message: 'The otp field is required.',
          errors: { otp: ['The otp field is required.'] },
        },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const user = await this.db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      throw new HttpException(
        { message: 'User not found' },
        HttpStatus.NOT_FOUND, // 404
      );
    }

    if (user.emailVerifiedAt) {
      return {
        message: 'Email already verified',
        already_verified: true,
      };
    }

    if (!user.otp) {
      throw new HttpException(
        { message: 'No OTP found. Please request a new one.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    if (user.otpExpiresAt && new Date() > user.otpExpiresAt) {
      throw new HttpException(
        {
          message: 'OTP has expired. Please request a new one.',
          expired: true,
        },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    if (user.otp !== otp) {
      throw new HttpException(
        { message: 'Invalid OTP. Please try again.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    await this.db
      .update(users)
      .set({
        emailVerifiedAt: new Date(),
        isVerified: 'true',
        otp: null,
        otpExpiresAt: null,
      })
      .where(eq(users.id, user.id));

    const updatedUser = {
      ...user,
      emailVerifiedAt: new Date(),
      isVerified: 'true',
      role: user.role ?? 'User',
    };
    const token = this.signToken(updatedUser);

    // Trigger Welcome notification for verified user
    this.notificationsService.createAndEmitNotification({
      userId: user.id,
      recipientGroup: 'customer',
      title: '👋 Welcome to Zelton!',
      message: `Hi ${user.name}, welcome to Zelton E-Commerce! Explore our latest products and exclusive deals.`,
      type: 'WELCOME',
      priority: 'NORMAL',
      entityType: 'user',
      entityId: user.id,
      referenceKey: `WELCOME_USER_${user.id}`,
      link: '/products',
      userEmail: user.email,
    }).catch(err => this.logger.error('Failed to emit welcome notification:', err));

    return {
      message: 'Email verified successfully! You can now login.',
      token,
      user: this.formatUser(updatedUser),
    };
  }

  async resendOTP(email: string): Promise<any> {
    if (!email) {
      throw new HttpException(
        {
          message: 'The email field is required.',
          errors: { email: ['The email field is required.'] },
        },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const user = await this.db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      throw new HttpException(
        { message: 'User not found' },
        HttpStatus.NOT_FOUND, // 404
      );
    }

    if (user.emailVerifiedAt) {
      return { message: 'Email already verified' };
    }

    if (
      user.otpExpiresAt &&
      new Date() < new Date(user.otpExpiresAt.getTime() - 9 * 60 * 1000)
    ) {
      const remainingSeconds = Math.ceil(
        (new Date(user.otpExpiresAt.getTime() - 9 * 60 * 1000).getTime() -
          Date.now()) /
          1000,
      );
      throw new HttpException(
        {
          message: `Please wait ${remainingSeconds} seconds before requesting a new OTP.`,
          retry_after: remainingSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS, // 429
      );
    }

    const otp = this.generateOtp();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.db
      .update(users)
      .set({ otp, otpExpiresAt })
      .where(eq(users.id, user.id));

    try {
      await this.mailService.sendOtp(email, user.name, otp);
      return { message: 'A new OTP has been sent to your email.' };
    } catch (err) {
      this.logger.error(`Error sending OTP email: ${err.message}`);
      throw new HttpException(
        { message: 'Failed to send OTP. Please try again later.' },
        HttpStatus.INTERNAL_SERVER_ERROR, // 500
      );
    }
  }

  async login(body: { email?: string; password?: string }): Promise<any> {
    if (!body.email && !body.password) {
      throw new HttpException(
        { message: 'Email or Password is required' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    let user: any = null;

    if (body.email) {
      user = await this.db.query.users.findFirst({
        where: eq(users.email, body.email),
      });

      if (!user) {
        throw new HttpException(
          { message: 'Invalid email' },
          HttpStatus.UNAUTHORIZED, // 401
        );
      }

      if (body.password) {
        const passwordValid = await bcrypt.compare(
          body.password,
          user.password ?? '',
        );
        if (!passwordValid) {
          throw new HttpException(
            { message: 'Invalid password' },
            HttpStatus.UNAUTHORIZED, // 401
          );
        }
      }
    } else if (body.password) {
      const allUsers = await this.db.query.users.findMany();
      for (const u of allUsers) {
        if (u.password && (await bcrypt.compare(body.password, u.password))) {
          user = u;
          break;
        }
      }
      if (!user) {
        throw new HttpException(
          { message: 'Invalid password' },
          HttpStatus.UNAUTHORIZED, // 401
        );
      }
    }

    if (!user.emailVerifiedAt && !user.googleId) {
      throw new HttpException(
        {
          message:
            'Please verify your email before logging in. Check your inbox for the OTP code.',
          email_not_verified: true,
          email: user.email,
        },
        HttpStatus.FORBIDDEN, // 403
      );
    }

    if (!user.status) {
      throw new HttpException(
        {
          res: 'error',
          message:
            'Your account has been blocked by the administrator. Please contact support for assistance.',
          error: 'account_blocked',
        },
        HttpStatus.FORBIDDEN, // 403
      );
    }

    const token = this.signToken(user);
    return {
      message: 'Login successful',
      token,
      user: this.formatUser(user),
    };
  }

  async forgotPassword(email: string): Promise<any> {
    if (!email) {
      throw new HttpException(
        {
          message: 'The email field is required.',
          errors: { email: ['The email field is required.'] },
        },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const user = await this.db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      throw new HttpException(
        {
          message: 'The selected email is invalid.',
          errors: { email: ['The selected email is invalid.'] },
        },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const existing = await this.db.query.passwordResetTokens.findFirst({
      where: eq(passwordResetTokens.email, email),
    });

    if (existing && existing.createdAt) {
      const twoMinutesLater = new Date(
        existing.createdAt.getTime() + 2 * 60 * 1000,
      );
      if (new Date() < twoMinutesLater) {
        const remainingSeconds = Math.ceil(
          (twoMinutesLater.getTime() - Date.now()) / 1000,
        );
        throw new HttpException(
          { message: `You can request a new code after ${remainingSeconds} seconds.` },
          HttpStatus.TOO_MANY_REQUESTS, // 429
        );
      }
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.email, email));
    await this.db
      .insert(passwordResetTokens)
      .values({ email, token: code, createdAt: new Date(), expiresAt });

    try {
      await this.mailService.sendPasswordReset(email, code);
    } catch (err) {
      this.logger.error(`Error sending password reset email: ${err.message}`);
    }

    return { message: 'Password reset code sent to your email' };
  }

  async resetPassword(body: {
    email?: string;
    code?: string;
    token?: string;
    password?: string;
    password_confirmation?: string;
  }): Promise<any> {
    if (!body.email) {
      throw new HttpException(
        {
          message: 'The email field is required.',
          errors: { email: ['The email field is required.'] },
        },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const resetCode = body.code || body.token;
    if (!resetCode) {
      throw new HttpException(
        {
          message: 'The code field is required.',
          errors: { code: ['The code field is required.'] },
        },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    if (!body.password) {
      throw new HttpException(
        {
          message: 'The password field is required.',
          errors: { password: ['The password field is required.'] },
        },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    if (body.password.length < 6) {
      throw new HttpException(
        {
          message: 'The password field must be at least 6 characters.',
          errors: { password: ['The password field must be at least 6 characters.'] },
        },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    if (body.password_confirmation && body.password !== body.password_confirmation) {
      throw new HttpException(
        {
          message: 'The password field confirmation does not match.',
          errors: { password: ['The password field confirmation does not match.'] },
        },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const record = await this.db.query.passwordResetTokens.findFirst({
      where: and(
        eq(passwordResetTokens.email, body.email),
        eq(passwordResetTokens.token, resetCode),
      ),
    });

    if (!record) {
      throw new HttpException(
        { message: 'Invalid reset code' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    if (record.expiresAt && new Date() > record.expiresAt) {
      throw new HttpException(
        { message: 'Reset code has expired' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const hashedPassword = await bcrypt.hash(body.password, 12);
    await this.db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.email, body.email));
    await this.db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.email, body.email));

    const userRec = await this.db.query.users.findFirst({ where: eq(users.email, body.email) });
    if (userRec) {
      this.notificationsService.createAndEmitNotification({
        userId: userRec.id,
        recipientGroup: 'customer',
        title: '🔒 Password Changed Successfully',
        message: 'Your account password was recently changed. If you did not make this change, please contact support immediately.',
        type: 'PASSWORD_CHANGED',
        priority: 'CRITICAL',
        entityType: 'user',
        entityId: userRec.id,
        referenceKey: `PWD_CHANGED_${userRec.id}_${Date.now()}`,
        link: '/profile',
        userEmail: body.email,
      }).catch(err => this.logger.error('Failed to emit password change notification:', err));
    }

    return { message: 'Password reset successful' };
  }

  async googleLogin(googleToken: string): Promise<any> {
    if (!googleToken) {
      throw new HttpException(
        { message: 'Invalid Google token' },
        HttpStatus.UNAUTHORIZED, // 401
      );
    }

    try {
      const configuredClientId = this.config.get<string>('GOOGLE_CLIENT_ID');
      const validAudiences = Array.from(new Set([
        configuredClientId,
        '470842240344-3a3rgpa8iepca97mk57s8nekdipah3e2.apps.googleusercontent.com',
        '320457787922-e7ca6bq62fsbl8o5po4m8686vsbj3q8b.apps.googleusercontent.com',
      ].filter(Boolean))) as string[];

      const ticket = await this.googleClient.verifyIdToken({
        idToken: googleToken,
        audience: validAudiences,
      });
      const payload = ticket.getPayload();
      if (!payload) {
        throw new HttpException(
          { message: 'Invalid Google token' },
          HttpStatus.UNAUTHORIZED, // 401
        );
      }

      const { sub: googleId, email, name, picture } = payload;

      let user = await this.db.query.users.findFirst({
        where: eq(users.email, email!),
      });

      if (user) {
        const updates: any = {};
        if (!user.googleId) updates.googleId = googleId;
        if (!user.emailVerifiedAt) {
          updates.emailVerifiedAt = new Date();
          updates.isVerified = 'true';
        }
        if (Object.keys(updates).length > 0) {
          await this.db
            .update(users)
            .set(updates)
            .where(eq(users.id, user.id));
          user = { ...user, ...updates };
        }
      } else {
        const hashedPassword = await bcrypt.hash(
          Math.random().toString(36),
          12,
        );
        const [inserted] = await this.db
          .insert(users)
          .values({
            name: name!,
            email: email!,
            googleId,
            profilePicture: picture ?? null,
            emailVerifiedAt: new Date(),
            isVerified: 'true',
            status: true,
            role: 'User',
            password: hashedPassword,
          })
          .$returningId();
        user = await this.db.query.users.findFirst({
          where: eq(users.id, inserted.id),
        });
      }

      if (!user!.status) {
        throw new HttpException(
          {
            res: 'error',
            message:
              'Your account has been blocked by the administrator. Please contact support for assistance.',
            error: 'account_blocked',
          },
          HttpStatus.FORBIDDEN, // 403
        );
      }

      const token = this.signToken(user!);
      return {
        message: 'Login successful',
        token,
        user: this.formatUser(user!),
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`Google login failed: ${err.message}`);
      throw new HttpException(
        { message: 'Invalid Google token' },
        HttpStatus.UNAUTHORIZED, // 401
      );
    }
  }

  async me(userId: number): Promise<any> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user) throw new UnauthorizedException('User not found');
    return { user: this.formatUser(user) };
  }

  async allUsers(): Promise<any> {
    const result = await this.db.query.users.findMany({
      where: eq(users.role, 'User'),
      columns: {
        id: true,
        name: true,
        email: true,
        profilePicture: true,
        phoneNumber: true,
        address: true,
        status: true,
      },
    });

    return result.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      profile_picture: u.profilePicture,
      phone_number: u.phoneNumber,
      address: u.address,
      status: u.status,
    }));
  }

  formatUser(user: any) {
    const isVerified =
      user.isVerified === 'true' ||
      user.isVerified === '1' ||
      user.isVerified === true ||
      user.isVerified === 1 ||
      Boolean(user.emailVerifiedAt);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phoneNumber ?? null,
      phone_number: user.phoneNumber ?? null,
      address: user.address ?? null,
      profile_picture: user.profilePicture ?? null,
      status: Boolean(user.status),
      role: user.role ?? 'User',
      email_verified_at: user.emailVerifiedAt ?? null,
      is_verified: isVerified,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    };
  }
}

