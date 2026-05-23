import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY, UserRepository } from '../domain/user.repository';
import { REFRESH_TOKEN_REPOSITORY, RefreshTokenRepository } from '../domain/refresh-token.repository';
import { TokenService, AuthTokens } from './token.service';
import { InvalidCredentialsError } from '../../../shared/errors/domain-error';

@Injectable()
export class RefreshUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refresh: RefreshTokenRepository,
    private readonly tokens: TokenService,
  ) {}

  async execute(refreshToken: string, meta: { userAgent?: string; ip?: string } = {}): Promise<AuthTokens> {
    let payload: { sub: string; jti: string };
    try {
      payload = await this.tokens.verifyRefresh(refreshToken);
    } catch {
      throw new InvalidCredentialsError();
    }

    const stored = await this.refresh.findByJti(payload.jti);
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      // Possível replay: revoga tudo do usuário por segurança
      await this.refresh.revokeAllForUser(payload.sub);
      throw new InvalidCredentialsError();
    }

    const user = await this.users.findById(payload.sub);
    if (!user) throw new InvalidCredentialsError();

    // Rotação: invalida o antigo, emite novo
    await this.refresh.revoke(payload.jti);
    const newTokens = await this.tokens.issue({
      id: user.id, email: user.email, isPremium: user.isPremium,
    });
    await this.refresh.create({
      jti: newTokens.refreshJti,
      userId: user.id,
      expiresAt: newTokens.refreshExpiresAt,
      userAgent: meta.userAgent,
      ip: meta.ip,
    });
    return newTokens;
  }
}
