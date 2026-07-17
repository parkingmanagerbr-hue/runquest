import {
  Body, Controller, Get, Header, HttpException, HttpStatus, Module, Param, Patch, Post, Query, Res, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsISO8601, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { AiCompletionService, AiCompletionModule } from '../../shared/kernel/ai-completion.service';
// AI provider: Gemini (multi-key rotation) replaces Anthropic
import { JwtAuthGuard } from '../auth/infrastructure/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../../shared/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { MissionsModule, MissionProgressService } from '../missions/missions.module';
import { ChallengesModule, ChallengeProgressService } from '../challenges/challenges.module';
import { TerritoriesModule, TerritoryService } from '../territories/territories.module';
import { GamificationModule, BadgeUnlockService } from '../gamification/gamification.module';
import { GoalsModule, GoalProgressService } from '../goals/goals.module';
import { computeStreak, computeRunRewards, levelForXp } from './run-rewards';

class CreateRunDto {
  @IsISO8601() startedAt!: string;
  @IsISO8601() endedAt!: string;
  @IsNumber() @Min(0) distanceMeters!: number;
  @IsInt() @Min(0) durationSec!: number;
  @IsInt() @Min(0) avgPaceSecPerKm!: number;
  @IsOptional() pointsGeoJson?: unknown;
  @IsOptional() @IsString() opId?: string;
  @IsOptional() @IsString() source?: 'GPS' | 'MANUAL';
  @IsOptional() @IsNumber() elevationGainM?: number;
  @IsOptional() @IsNumber() elevationLossM?: number;
  @IsOptional() @IsNumber() avgSpeedKmh?: number;
}

@ApiTags('runs')
@Controller('runs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RunsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly missions: MissionProgressService,
    private readonly challenges: ChallengeProgressService,
    private readonly territories: TerritoryService,
    private readonly badges: BadgeUnlockService,
    private readonly goals: GoalProgressService,
    private readonly ai: AiCompletionService,
  ) {}

  @Post()
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateRunDto) {
    if (dto.opId) {
      const existing = await this.prisma.run.findUnique({ where: { opId: dto.opId } });
      if (existing) return { ...existing, xpGained: 0, coinsGained: 0, newTerritories: 0, newBadges: [] };
    }
    const run = await this.prisma.run.create({
      data: {
        userId: user.id,
        startedAt: new Date(dto.startedAt),
        endedAt: new Date(dto.endedAt),
        distanceMeters: dto.distanceMeters,
        durationSec: dto.durationSec,
        avgPaceSecPerKm: dto.avgPaceSecPerKm,
        pointsGeoJson: (dto.pointsGeoJson ?? {}) as any,
        source: dto.source ?? 'GPS',
        opId: dto.opId,
        elevationGainM: dto.elevationGainM,
        elevationLossM: dto.elevationLossM,
        avgSpeedKmh: dto.avgSpeedKmh,
      },
    });

    // Streak
    const u = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { lastRunAt: true, streakDays: true, longestStreak: true } as any,
    }) as any;
    const newStreak = computeStreak(u?.lastRunAt ? new Date(u.lastRunAt) : null, new Date(), u?.streakDays ?? 0);
    const longestStreak = Math.max(u?.longestStreak ?? 0, newStreak);

    // XP + moedas + multiplicador de streak (cap 7 dias = 1.35×)
    const { xpGain, coinGain, streakMult } = computeRunRewards(dto.distanceMeters, dto.durationSec, newStreak);

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        xp: { increment: xpGain },
        runCoins: { increment: coinGain },
        lastRunAt: new Date(),
        streakDays: newStreak,
        longestStreak,
        totalRuns: { increment: 1 },
        totalDistanceM: { increment: dto.distanceMeters },
      } as any,
    });
    const newLevel = levelForXp(updatedUser.xp, updatedUser.level);
    if (newLevel !== updatedUser.level) {
      await this.prisma.user.update({ where: { id: user.id }, data: { level: newLevel } });
    }

    // Missões + Desafios + Goals
    await this.missions.applyRun(user.id, { distanceMeters: dto.distanceMeters, durationSec: dto.durationSec });
    await this.challenges.applyRun(user.id, { distanceMeters: dto.distanceMeters, durationSec: dto.durationSec });
    await this.goals.applyRun(user.id, { distanceMeters: dto.distanceMeters, durationSec: dto.durationSec });

    // Territórios
    const coords = (dto.pointsGeoJson as any)?.coordinates as number[][] | undefined;
    let territoryStats = { visited: 0, newCaptures: 0 };
    if (coords && coords.length > 0) {
      territoryStats = await this.territories.applyRun(user.id, coords);
    }
    const totalTerritories = await (this.prisma as any).territory.count({
      where: { userId: user.id, capturedAt: { not: null } },
    });

    // Badges
    const newBadges = await this.badges.checkAndUnlock(user.id, {
      totalRuns: (updatedUser as any).totalRuns,
      totalDistanceM: (updatedUser as any).totalDistanceM,
      streak: newStreak,
      level: newLevel,
      territories: totalTerritories,
      singleRunDistanceM: dto.distanceMeters,
      singleRunPaceSecPerKm: dto.avgPaceSecPerKm,
    });

    return {
      ...run,
      xpGained: xpGain,
      coinsGained: coinGain,
      streakMultiplier: streakMult,
      newTerritories: territoryStats.newCaptures,
      visitedCells: territoryStats.visited,
      streakDays: newStreak,
      level: newLevel,
      newLevel: newLevel !== updatedUser.level ? newLevel : undefined,
      newBadges,
    };
  }

  @Get()
  async list(@CurrentUser() user: RequestUser, @Query('limit') limit?: number) {
    return this.prisma.run.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: 'desc' },
      take: Math.min(Number(limit) || 30, 100),
    });
  }

  /** GET /runs/stats/week — Stats for current week (Mon→Sun) */
  @Get('stats/week')
  async weekStats(@CurrentUser() user: RequestUser) {
    const now = new Date();
    // Monday of current week
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));

    const runs = await this.prisma.run.findMany({
      where: { userId: user.id, startedAt: { gte: monday } },
      select: { distanceMeters: true, durationSec: true, avgPaceSecPerKm: true, startedAt: true },
    });

    const totalKm = runs.reduce((a, r) => a + r.distanceMeters / 1000, 0);
    const totalSec = runs.reduce((a, r) => a + r.durationSec, 0);
    const avgPace = runs.length > 0
      ? Math.round(runs.reduce((a, r) => a + r.avgPaceSecPerKm, 0) / runs.length)
      : 0;

    // Day-by-day breakdown (0=Mon … 6=Sun)
    const byDay = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const dayRuns = runs.filter(r => {
        const rd = new Date(r.startedAt); rd.setHours(0, 0, 0, 0);
        return rd.getTime() === d.getTime();
      });
      return {
        day: i,
        km: Math.round(dayRuns.reduce((a, r) => a + r.distanceMeters / 1000, 0) * 10) / 10,
        runs: dayRuns.length,
      };
    });

    // Last 4 weeks for trend
    const fourWeeksAgo = new Date(monday); fourWeeksAgo.setDate(monday.getDate() - 28);
    const prevRuns = await this.prisma.run.findMany({
      where: { userId: user.id, startedAt: { gte: fourWeeksAgo, lt: monday } },
      select: { distanceMeters: true, startedAt: true },
    });
    const prevWeekKm = prevRuns
      .filter(r => new Date(r.startedAt) >= new Date(monday.getTime() - 7 * 86400000))
      .reduce((a, r) => a + r.distanceMeters / 1000, 0);

    return {
      weekStart: monday.toISOString(),
      runs: runs.length,
      totalKm: Math.round(totalKm * 100) / 100,
      totalSec,
      avgPaceSecPerKm: avgPace,
      byDay,
      prevWeekKm: Math.round(prevWeekKm * 100) / 100,
      trend: prevWeekKm > 0 ? ((totalKm - prevWeekKm) / prevWeekKm) * 100 : null,
    };
  }

  /** GET /runs/stats/prs — Personal Records: best pace per distance bracket */
  @Get('stats/prs')
  async personalRecords(@CurrentUser() user: RequestUser) {
    const allRuns = await this.prisma.run.findMany({
      where: { userId: user.id },
      select: { id: true, distanceMeters: true, durationSec: true, avgPaceSecPerKm: true, startedAt: true },
      orderBy: { startedAt: 'desc' },
    });

    const brackets = [
      { label: '5K', minM: 4500, maxM: 5600 },
      { label: '10K', minM: 9000, maxM: 11000 },
      { label: '21K', minM: 19000, maxM: 23000 },
      { label: '42K', minM: 40000, maxM: 44000 },
    ];

    return brackets.map(b => {
      const candidates = allRuns.filter(r => r.distanceMeters >= b.minM && r.distanceMeters <= b.maxM);
      if (candidates.length === 0) return { label: b.label, best: null };
      const best = candidates.reduce((prev, cur) =>
        cur.avgPaceSecPerKm < prev.avgPaceSecPerKm ? cur : prev
      );
      return {
        label: b.label,
        best: {
          runId: best.id,
          paceSecPerKm: best.avgPaceSecPerKm,
          durationSec: best.durationSec,
          distanceMeters: best.distanceMeters,
          date: best.startedAt,
        },
      };
    });
  }

  /** GET /runs/:id — Single run detail */
  @Get(':id')
  async findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const run = await this.prisma.run.findFirst({ where: { id, userId: user.id } });
    if (!run) return null;
    return run;
  }

  /** PATCH /runs/:id/notes — Save personal notes for a run */
  @Patch(':id/notes')
  async updateNotes(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { notes: string },
  ) {
    try {
      const run = await this.prisma.run.findFirst({ where: { id, userId: user.id } });
      if (!run) throw new HttpException('Run not found', HttpStatus.NOT_FOUND);
      await this.prisma.run.update({ where: { id }, data: { notes: body.notes ?? '' } });
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      throw new HttpException('Run not found', HttpStatus.NOT_FOUND);
    }
    return { ok: true };
  }

  /** GET /runs/:id/gpx — Download GPX file for external apps */
  @Get(':id/gpx')
  @Header('Content-Type', 'application/gpx+xml')
  async gpx(@CurrentUser() user: RequestUser, @Param('id') runId: string, @Res() res: Response) {
    const run = await this.prisma.run.findFirst({ where: { id: runId, userId: user.id } });
    if (!run) { res.status(404).send('Not found'); return; }
    const coords = (run.pointsGeoJson as any)?.coordinates as number[][] ?? [];
    const trkpts = coords.map(([lng, lat]) =>
      `    <trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}"></trkpt>`
    ).join('\n');
    const startedAt = run.startedAt.toISOString();
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RunQuest" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><time>${startedAt}</time></metadata>
  <trk>
    <name>RunQuest ${startedAt.slice(0, 10)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
    res.setHeader('Content-Disposition', `attachment; filename="runquest-${runId.slice(0, 8)}.gpx"`);
    res.send(gpx);
  }

  /** POST /runs/:id/analyze — AI post-run coaching analysis (Premium) */
  @Post(':id/analyze')
  async analyze(@CurrentUser() user: RequestUser, @Param('id') runId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { isPremium: true, isOwner: true, level: true, streakDays: true },
    });
    if (!u?.isPremium && !u?.isOwner) {
      return { analysis: null, premium: false };
    }

    const run = await this.prisma.run.findFirst({ where: { id: runId, userId: user.id } });
    if (!run) return { error: 'NOT_FOUND' };

    const recentRuns = await this.prisma.run.findMany({
      where: { userId: user.id, id: { not: runId } },
      orderBy: { startedAt: 'desc' },
      take: 5,
      select: { distanceMeters: true, durationSec: true, avgPaceSecPerKm: true },
    });

    const avgPaceStr = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    const recentSummary = recentRuns.length > 0
      ? recentRuns.map(r => `${(r.distanceMeters / 1000).toFixed(1)}km @ ${avgPaceStr(r.avgPaceSecPerKm)}/km`).join(', ')
      : 'first run';

    const prompt = `Você é um treinador de corrida. Analise esta corrida e dê feedback curto e prático em português brasileiro (2-3 frases no máximo):

Esta corrida: ${(run.distanceMeters / 1000).toFixed(2)}km, tempo ${Math.floor(run.durationSec / 60)}min ${run.durationSec % 60}s, pace ${avgPaceStr(run.avgPaceSecPerKm)}/km
Corridas recentes: ${recentSummary}
Nível do corredor: ${u.level}, sequência: ${u.streakDays} dias

Dê feedback encorajador e específico comparando esta corrida com as recentes. Inclua 1 dica de melhoria. Máximo 60 palavras. Use emoji.`;

    // Cadeia Gemini→SambaNova via serviço compartilhado (antes duplicada aqui).
    try {
      const analysis = await this.ai.complete(prompt, { maxTokens: 256 });
      return { analysis, premium: true };
    } catch {
      // BUG corrigido: antes retornava `premium: false` quando a IA falhava, e a
      // UI mostrava "assine o Premium" para quem JÁ É premium. O usuário é
      // premium (checado acima) — o que faltou foi a IA.
      return { analysis: null, premium: true, error: 'AI_UNAVAILABLE' };
    }
  }
}

/** Public controller — NO JwtAuthGuard, no auth required */
@ApiTags('runs-public')
@Controller('runs/public')
export class RunsPublicController {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /runs/public/:id — Shareable run detail without authentication */
  @Get(':id')
  async findPublic(@Param('id') id: string) {
    let run: any = null;
    try {
      run = await this.prisma.run.findUnique({
        where: { id },
        select: {
          id: true,
          distanceMeters: true,
          durationSec: true,
          avgPaceSecPerKm: true,
          startedAt: true,
          elevationGainM: true,
          pointsGeoJson: true,
          user: {
            select: {
              displayName: true,
              avatarUrl: true,
              level: true,
            },
          },
        },
      });
    } catch {
      throw new HttpException('Run not found', HttpStatus.NOT_FOUND);
    }
    if (!run) throw new HttpException('Run not found', HttpStatus.NOT_FOUND);
    return run;
  }
}

@Module({
  imports: [MissionsModule, ChallengesModule, TerritoriesModule, GamificationModule, GoalsModule, AiCompletionModule],
  controllers: [RunsController, RunsPublicController],
})
export class RunsModule {}
