import {
  Controller, Get, Post, Query, Param, Res, UseGuards, Req, HttpCode,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../../../shared/decorators/current-user.decorator';
import { ConnectStravaUseCase } from '../application/connect-strava.usecase';
import { ImportStravaActivitiesUseCase } from '../application/import-activities.usecase';
import { ExportRunToStravaUseCase } from '../application/export-run.usecase';
import { PrismaService } from '../../../prisma/prisma.service';

@ApiTags('strava')
@Controller('strava')
export class StravaController {
  constructor(
    private readonly connectUc: ConnectStravaUseCase,
    private readonly importUc: ImportStravaActivitiesUseCase,
    private readonly exportUc: ExportRunToStravaUseCase,
    private readonly prisma: PrismaService,
    private readonly cfg: ConfigService,
  ) {}

  /** Inicia OAuth — usuário autenticado, redireciona para Strava. */
  @Get('connect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async connect(@CurrentUser() user: RequestUser, @Res() res: Response) {
    const url = this.connectUc.beginAuth(user.id);
    return res.redirect(url);
  }

  /** Retorna URL de autorização (chamado via fetch+Bearer no frontend). */
  @Get('authorize-url')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  authorizeUrl(@CurrentUser() user: RequestUser): { url: string } {
    return { url: this.connectUc.beginAuth(user.id) };
  }

  /** Callback público que recebe o code da Strava. */
  @Get('callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    const base = this.cfg.get<string>('APP_BASE_URL', 'https://runquest.veloxisit.com.br');
    try {
      const r = await this.connectUc.handleCallback(code, state);
      return res.redirect(`${base}/app?strava=connected&athlete=${r.athleteId}`);
    } catch (e: any) {
      return res.redirect(`${base}/app?strava=error&reason=${encodeURIComponent(e.message)}`);
    }
  }

  @Get('status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async status(@CurrentUser() user: RequestUser) {
    const t = await this.prisma.stravaToken.findUnique({
      where: { userId: user.id },
      select: { athleteId: true, expiresAt: true, scope: true, createdAt: true },
    });
    return {
      connected: !!t,
      athleteId: t ? t.athleteId.toString() : null,
      scope: t?.scope ?? null,
      tokenValid: t ? t.expiresAt > new Date() : false,
    };
  }

  @Post('disconnect')
  @HttpCode(204)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async disconnect(@CurrentUser() user: RequestUser) {
    await this.connectUc.disconnect(user.id);
  }

  @Post('import')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async import(@CurrentUser() user: RequestUser, @Query('sinceDays') sinceDays?: string) {
    return this.importUc.execute(user.id, { sinceDays: sinceDays ? Number(sinceDays) : undefined });
  }

  @Post('export/:runId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async exportRun(@CurrentUser() user: RequestUser, @Param('runId') runId: string) {
    return this.exportUc.execute(user.id, runId);
  }
}
