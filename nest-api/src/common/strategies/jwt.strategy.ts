import { Injectable, UnauthorizedException, ForbiddenException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.provider';
import type { DrizzleDB } from '../../database/database.provider';
import { users } from '../../database/schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @Inject(DRIZZLE) private db: DrizzleDB,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'default_secret'),
    });
  }

  async validate(payload: any) {
    if (!payload.sub) throw new UnauthorizedException();

    // Load fresh user from DB so status/role is always current
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, payload.sub),
    });

    if (!user) throw new UnauthorizedException('User not found');

    // Block banned users on every authenticated request
    if (!user.status) {
      throw new ForbiddenException({
        res: 'error',
        message: 'Your account has been blocked by the administrator.',
        error: 'account_blocked',
      });
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role ?? 'User',
      status: user.status,
    };
  }
}
