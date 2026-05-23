import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './presentation/auth.controller';
import { RegisterUseCase } from './application/register.usecase';
import { LoginUseCase } from './application/login.usecase';
import { RefreshUseCase } from './application/refresh.usecase';
import { GoogleLoginUseCase } from './application/google-login.usecase';
import { TokenService } from './application/token.service';
import { USER_REPOSITORY } from './domain/user.repository';
import { REFRESH_TOKEN_REPOSITORY } from './domain/refresh-token.repository';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { PrismaRefreshTokenRepository } from './infrastructure/prisma-refresh-token.repository';
import { JwtStrategy } from './infrastructure/jwt.strategy';
import { GoogleStrategy } from './infrastructure/google.strategy';

@Module({
  imports: [ConfigModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    RegisterUseCase, LoginUseCase, RefreshUseCase, GoogleLoginUseCase,
    TokenService,
    JwtStrategy, GoogleStrategy,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: PrismaRefreshTokenRepository },
  ],
  exports: [TokenService, USER_REPOSITORY],
})
export class AuthModule {}
