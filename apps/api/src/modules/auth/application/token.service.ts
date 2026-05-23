import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshJti: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
  ) {}

  async issue(user: { id: string; email: string; isPremium: boolean }): Promise<AuthTokens> {
    const accessTtl = this.cfg.get<number>('JWT_ACCESS_TTL', 900);
    const refreshTtl = this.cfg.get<number>('JWT_REFRESH_TTL', 2_592_000);
    const refreshJti = randomUUID();

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, premium: user.isPremium },
      { secret: this.cfg.get<string>('JWT_ACCESS_SECRET'), expiresIn: accessTtl },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, jti: refreshJti },
      { secret: this.cfg.get<string>('JWT_REFRESH_SECRET'), expiresIn: refreshTtl },
    );
    return {
      accessToken,
      refreshToken,
      refreshJti,
      refreshExpiresAt: new Date(Date.now() + refreshTtl * 1000),
    };
  }

  verifyRefresh(token: string): Promise<{ sub: string; jti: string }> {
    return this.jwt.verifyAsync(token, { secret: this.cfg.get<string>('JWT_REFRESH_SECRET') });
  }
}
