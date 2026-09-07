import { Body, Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller()
export class AuthController {
  constructor(private authService: AuthService) {}

  // POST /api/register
  @Post('register')
  register(@Body() body: any): Promise<any> {
    return this.authService.register(body);
  }

  // POST /api/verify
  @Post('verify')
  verify(@Body() body: { email: string; code?: string; otp?: string }): Promise<any> {
    return this.authService.verify(body.email, body.code || body.otp || '');
  }

  // POST /api/verify-otp
  @Post('verify-otp')
  verifyOTP(@Body() body: { email: string; otp?: string; code?: string }): Promise<any> {
    return this.authService.verifyOTP(body.email, body.otp || body.code || '');
  }

  // POST /api/verify-email-code
  @Post('verify-email-code')
  verifyEmailCode(@Body() body: { email: string; code?: string; otp?: string }): Promise<any> {
    return this.authService.verify(body.email, body.code || body.otp || '');
  }

  // POST /api/resend-otp
  @Post('resend-otp')
  resendOTP(@Body() body: { email: string }): Promise<any> {
    return this.authService.resendOTP(body.email);
  }

  // POST /api/login
  @Post('login')
  login(@Body() body: { email?: string; password?: string }): Promise<any> {
    return this.authService.login(body);
  }

  // POST /api/forgot-password
  @Post('forgot-password')
  forgotPassword(@Body() body: { email: string }): Promise<any> {
    return this.authService.forgotPassword(body.email);
  }

  // POST /api/reset-password
  @Post('reset-password')
  resetPassword(@Body() body: { email: string; code?: string; token?: string; password: string; password_confirmation?: string }): Promise<any> {
    return this.authService.resetPassword(body);
  }

  // POST /api/auth/google
  @Post('auth/google')
  googleLogin(@Body() body: { token: string }): Promise<any> {
    return this.authService.googleLogin(body.token);
  }

  // GET /api/user  [Protected]
  @UseGuards(JwtAuthGuard)
  @Get('user')
  me(@Request() req: any): Promise<any> {
    return this.authService.me(req.user.id);
  }

  // GET /api/all_users  [Protected]
  @UseGuards(JwtAuthGuard)
  @Get('all_users')
  allUsers(): Promise<any> {
    return this.authService.allUsers();
  }

  // POST /api/logout  [Protected]
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(): Promise<any> {
    return Promise.resolve({ message: 'Logged out' });
  }
}

