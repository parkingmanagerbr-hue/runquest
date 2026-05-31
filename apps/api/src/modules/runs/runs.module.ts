import {
  Body, Controller, Get, Module, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsISO8601, IsNumber, IsOptional, IsString, Min } from 'class-validator';
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
}

@Module({
  imports: [MissionsModule, TerritoriesModule, GamificationModule, GoalsModule],
  controllers: [RunsController],
})
export class RunsModule {}
