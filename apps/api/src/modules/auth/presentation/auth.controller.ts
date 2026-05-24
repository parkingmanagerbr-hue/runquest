import {
  Body, Controller, Get, Post, Req, Res, UseGuards, HttpCode,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { RegisterUseCase } from '../application/register.usecase';
import { LoginUseCase } from '../application/login.usecase';
import { RefreshUseCase } from '../application/refresh.usecase';
import { GoogleLoginUseCase, GoogleProfile } from '../application/google-login.usecase';
import { TokenService } from '../application/token.service';
import { REFRESH_TOKEN_REPOSITORY, RefreshTokenRepository } from '../domain/refresh-token.repository';
import { RegisterDto, LoginDto, RefreshDto } from './auth.dto';
import { GoogleAuthGuard, JwtAuthGuard } from '../infrastructure/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../../../shared/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUc: RegisterUseCase,
    private readonly loginUc: LoginUseCase,
    private readonly refreshUc: RefreshUseCase,
    private readonly googleUc: GoogleLoginUseCase,
    private readonly tokens: TokenService,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshRepo: RefreshTokenRepository,
    private readonly cfg: ConfigService,
  ) {}

  @Post('register')
  @HttpCode(201)
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const user = await this.registerUc.execute(dto);
    const tokens = await this.tokens.issue({ id: user.id, email: user.email, isPremium: user.isPremium });
    await this.refreshRepo.create({
      jti: tokens.refreshJti, userId: user.id,
      expiresAt: tokens.refreshExpiresAt,
      userAgent: req.headers['user-agent'], ip: req.ip,
    });
    return {
      user: { id: user.id, email: user.email, displayName: user.displayName, isPremium: user.isPremium },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const tokens = await this.loginUc.execute({
      ...dto,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    const tokens = await this.refreshUc.execute(dto.refreshToken, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: RequestUser) {
    return user;
  }

  @Get('google/available')
  googleAvailable() {
    const hasId = !!this.cfg.get<string>('GOOGLE_CLIENT_ID')
      && this.cfg.get<string>('GOOGLE_CLIENT_ID') !== '<CHANGE>';
    return { available: hasId };
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  google(): void { /* Passport redireciona — só funciona se GOOGLE_CLIENT_ID configurado */ }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const profile = req.user as GoogleProfile;
    const tokens = await this.googleUc.execute(profile, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    const base = this.cfg.get<string>('APP_BASE_URL', 'http://localhost:3000');
    // Redireciona para o front passando os tokens (fragment evita ir pra logs do servidor)
    const url = `${base}/auth/callback#at=${tokens.accessToken}&rt=${tokens.refreshToken}`;
    return res.redirect(url);
  }
}
