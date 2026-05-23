import { Inject, Injectable } from '@nestjs/common';
import { Email } from '../domain/email.vo';
import { UserAccount } from '../domain/user-account.entity';
import { USER_REPOSITORY, UserRepository } from '../domain/user.repository';
import { REFRESH_TOKEN_REPOSITORY, RefreshTokenRepository } from '../domain/refresh-token.repository';
import { TokenService, AuthTokens } from './token.service';

export interface GoogleProfile {
  googleId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

@Injectable()
export class GoogleLoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refresh: RefreshTokenRepository,
    private readonly tokens: TokenService,
  ) {}

  async execute(profile: GoogleProfile, meta: { userAgent?: string; ip?: string } = {}): Promise<AuthTokens> {
    const email = Email.create(profile.email);

    // 1) Tenta encontrar pelo googleId
    let user = await this.users.findByGoogleId(profile.googleId);

    // 2) Caso contrário, busca por email (conta pré-existente — fundir)
    if (!user) {
      const byEmail = await this.users.findByEmail(email.value);
      if (byEmail) {
        byEmail.attachGoogle(profile.googleId);
        user = await this.users.save(byEmail);
      } else {
        user = await this.users.save(
          UserAccount.fromGoogle({ email, googleId: profile.googleId, displayName: profile.displayName }),
        );
      }
    }

    const tokens = await this.tokens.issue({
      id: user.id, email: user.email, isPremium: user.isPremium,
    });
    await this.refresh.create({
      jti: tokens.refreshJti,
      userId: user.id,
      expiresAt: tokens.refreshExpiresAt,
      userAgent: meta.userAgent,
      ip: meta.ip,
    });
    return tokens;
  }
}
