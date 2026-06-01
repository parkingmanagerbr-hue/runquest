import {
  Body, Controller, Get, Header, Module, Param, Post, Query, Res, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsISO8601, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { JwtAuthGuard } from '../auth/infrastructure/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../../shared/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { MissionsModule, MissionProgressService } from '../missions/missions.module';
import { TerritoriesModule, TerritoryService } from '../territories/territories.module';
import { GamificationModule, BadgeUnlockService } from '../gamification/gamification.module';
import { GoalsModule, GoalProgressService } from '../goals/goals.module';

class CreateRunDto {
  @IsISO8601() startedAt!: string;
  @IsISO8601() endedAt!: string;
  @IsNumber() @Min(0) distanceMeters!: number;
  @IsInt() @Min(0) durationSec!: number;
  @IsInt() @Min(0) avgPaceSecPerKm!: number;
  @IsOptional() pointsGeoJson?: unknown;
  @IsOptional() @IsString() opId?: string;
  @IsOptional() @IsString() source?: 'GPS' | 'MANUAL';
}

@ApiTags('runs')
@Controller('runs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RunsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly missions: MissionProgressService,
    private readonly territories: TerritoryService,
    private readonly badges: BadgeUnlockService,
    private readonly goals: GoalProgressService,
    private readonly cfg: ConfigService,
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
      },
    });

    const distKm = dto.distanceMeters / 1000;

    // Streak
    const u = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { lastRunAt: true, streakDays: true, longestStreak: true } as any,
    }) as any;
    let newStreak = 1;
    if (u?.lastRunAt) {
      const last = new Date(u.lastRunAt); last.setHours(0, 0, 0, 0);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const diffDays = Math.round((today.getTime() - last.getTime()) / 86400000);
      if (diffDays === 0) newStreak = u.streakDays;
      else if (diffDays === 1) newStreak = (u.streakDays ?? 0) + 1;
      else newStreak = 1;
    }
    const longestStreak = Math.max(u?.longestStreak ?? 0, newStreak);

    // STREAK MULTIPLIER: cap 7 dias = 1.35x
    const streakMult = 1 + Math.min(newStreak, 7) * 0.05;
    const baseXp = distKm * 10 + dto.durationSec / 60 + (distKm > 5 ? 20 : 0);
    const xpGain = Math.round(baseXp * streakMult);
    const coinGain = Math.round(distKm * 10);

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
    let newLevel = updatedUser.level;
    while (updatedUser.xp >= Math.round(100 * Math.pow(newLevel, 1.5))) newLevel++;
    if (newLevel !== updatedUser.level) {
      await this.prisma.user.update({ where: { id: user.id }, data: { level: newLevel } });
    }

    // Missões + Goals
    await this.missions.applyRun(user.id, { distanceMeters: dto.distanceMeters, durationSec: dto.durationSec });
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
    const apiKey = this.cfg.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey || (!u?.isPremium && !u?.isOwner)) {
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

    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `You are a running coach. Analyze this run and give short, practical feedback in Brazilian Portuguese (2-3 sentences max):

This run: ${(run.distanceMeters / 1000).toFixed(2)}km, time ${Math.floor(run.durationSec / 60)}min ${run.durationSec % 60}s, pace ${avgPaceStr(run.avgPaceSecPerKm)}/km
Recent runs: ${recentSummary}
Runner level: ${u.level}, streak: ${u.streakDays} days

Give encouraging, specific coaching feedback comparing this run to recent ones. Include 1 improvement tip. Keep under 60 words. Use emoji.`
      }],
    });

    const text = (msg.content[0] as any).text as string;
    return { analysis: text, premium: true };
  }
}

@Module({
  imports: [MissionsModule, TerritoriesModule, GamificationModule, GoalsModule],
  controllers: [RunsController],
})
export class RunsModule {}
