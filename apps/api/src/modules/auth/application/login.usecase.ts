import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY, UserRepository } from '../domain/user.repository';
import { REFRESH_TOKEN_REPOSITORY, RefreshTokenRepository } from '../domain/refresh-token.repository';
import { TokenService, AuthTokens } from './token.service';
import { InvalidCredentialsError } from '../../../shared/errors/domain-error';

export interface LoginInput {
  email: string;
  password: string;
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refresh: RefreshTokenRepository,
    private readonly tokens: TokenService,
  ) {}

  async execute(input: LoginInput): Promise<AuthTokens> {
    const user = await this.users.findByEmail(input.email.toLowerCase().trim());
    if (!user || !user.password) throw new InvalidCredentialsError();

    const ok = await user.password.matches(input.password);
    if (!ok) throw new InvalidCredentialsError();

    const tokens = await this.tokens.issue({
      id: user.id, email: user.email, isPremium: user.isPremium,
    });
    await this.refresh.create({
      jti: tokens.refreshJti,
      userId: user.id,
      expiresAt: tokens.refreshExpiresAt,
      userAgent: input.userAgent,
      ip: input.ip,
    });
    return tokens;
  }
}
