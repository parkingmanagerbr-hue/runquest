import {
  Body, Controller, Get, Injectable, Logger, Module, Param, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/infrastructure/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../../shared/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

/** Avalia se user desbloqueia novos badges. Chamado pós-run. */
@Injectable()
export class BadgeUnlockService {
  private readonly logger = new Logger(BadgeUnlockService.name);
  constructor(private readonly prisma: PrismaService) {}

  async checkAndUnlock(userId: string, ctx: {
    totalRuns?: number;
    totalDistanceM?: number;
    streak?: number;
    level?: number;
    territories?: number;
    singleRunDistanceM?: number;
    singleRunPaceSecPerKm?: number;
  }): Promise<{ id: string; code: string; title: string; icon: string; xp: number; coins: number }[]> {
    const badges = await (this.prisma as any).badge.findMany();
    const already = await (this.prisma as any).userBadge.findMany({
      where: { userId },
      select: { badgeId: true },
    });
    const ownedIds = new Set(already.map((u: any) => u.badgeId));
    const unlocked: any[] = [];
    for (const b of badges) {
      if (ownedIds.has(b.id)) continue;
      let qualifies = false;
      switch (b.requirementKind) {
        case 'total_runs': qualifies = (ctx.totalRuns ?? 0) >= b.requirementValue; break;
        case 'total_distance': qualifies = (ctx.totalDistanceM ?? 0) >= b.requirementValue; break;
        case 'streak': qualifies = (ctx.streak ?? 0) >= b.requirementValue; break;
        case 'level': qualifies = (ctx.level ?? 0) >= b.requirementValue; break;
        case 'territories': qualifies = (ctx.territories ?? 0) >= b.requirementValue; break;
        case 'single_run_distance': qualifies = (ctx.singleRunDistanceM ?? 0) >= b.requirementValue; break;
        case 'pace_under':
          qualifies = ctx.singleRunPaceSecPerKm != null
            && ctx.singleRunPaceSecPerKm > 0
            && ctx.singleRunPaceSecPerKm <= b.requirementValue;
          break;
      }
      if (!qualifies) continue;
      await (this.prisma as any).userBadge.create({ data: { id: crypto.randomUUID(), userId, badgeId: b.id } });
      if (b.xpReward > 0 || b.coinReward > 0) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { xp: { increment: b.xpReward }, runCoins: { increment: b.coinReward } },
        });
      }
      unlocked.push({ id: b.id, code: b.code, title: b.title, icon: b.icon, xp: b.xpReward, coins: b.coinReward });
    }
    return unlocked;
  }
}

@ApiTags('badges')
@Controller('badges')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BadgesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async all(@CurrentUser() user: RequestUser) {
    const [badges, unlocked] = await Promise.all([
      (this.prisma as any).badge.findMany({ orderBy: { order: 'asc' } }),
      (this.prisma as any).userBadge.findMany({
        where: { userId: user.id },
        select: { badgeId: true, unlockedAt: true },
      }),
    ]);
    const map = new Map(unlocked.map((u: any) => [u.badgeId, u.unlockedAt]));
    return badges.map((b: any) => ({
      ...b,
      unlocked: map.has(b.id),
      unlockedAt: map.get(b.id) ?? null,
    }));
  }
}

@ApiTags('leaderboard')
@Controller('leaderboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LeaderboardController {
  constructor(private readonly prisma: PrismaService) {}

  private weekStart(): Date {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const s = new Date(now); s.setDate(s.getDate() + diff); s.setHours(0, 0, 0, 0);
    return s;
  }

  /** ?kind = xp | distance | territories */
  @Get()
  async board(@CurrentUser() user: RequestUser, @Query('kind') kind: 'xp' | 'distance' | 'territories' = 'xp') {
    const start = this.weekStart();

    if (kind === 'xp') {
      // Soma de xp recente — aproximação por nível e XP totais (não temos XP por semana persistido).
      // Para v1: usar XP total como proxy. Idealmente teríamos XpLedger.
      const users = await this.prisma.user.findMany({
        orderBy: { xp: 'desc' },
        take: 100,
        select: { id: true, displayName: true, avatarUrl: true, level: true, xp: true, selectedAvatar: true },
      });
      return users.map((u, i) => ({
        rank: i + 1,
        userId: u.id,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        avatar: u.selectedAvatar,
        level: u.level,
        value: u.xp,
        isMe: u.id === user.id,
      }));
    }

    if (kind === 'distance') {
      const rows = await this.prisma.run.groupBy({
        by: ['userId'],
        where: { startedAt: { gte: start } },
        _sum: { distanceMeters: true },
        orderBy: { _sum: { distanceMeters: 'desc' } } as any,
        take: 100,
      });
      const users = await this.prisma.user.findMany({
        where: { id: { in: rows.map((r: any) => r.userId) } },
        select: { id: true, displayName: true, avatarUrl: true, level: true, selectedAvatar: true },
      });
      const um = new Map(users.map(u => [u.id, u]));
      return rows.map((r: any, i: number) => {
        const u = um.get(r.userId);
        return {
          rank: i + 1,
          userId: r.userId,
          displayName: u?.displayName ?? '?',
          avatarUrl: u?.avatarUrl,
          avatar: u?.selectedAvatar,
          level: u?.level ?? 1,
          value: Math.round((r._sum.distanceMeters ?? 0) / 100) / 10, // km com 1 casa
          isMe: r.userId === user.id,
        };
      });
    }

    // territories
    const captured = await (this.prisma as any).territory.groupBy({
      by: ['userId'],
      where: { capturedAt: { gte: start } },
      _count: { id: true },
      take: 100,
    });
    captured.sort((a: any, b: any) => b._count.id - a._count.id);
    const users = await this.prisma.user.findMany({
      where: { id: { in: captured.map((r: any) => r.userId) } },
      select: { id: true, displayName: true, avatarUrl: true, level: true, selectedAvatar: true },
    });
    const um = new Map(users.map(u => [u.id, u]));
    return captured.map((r: any, i: number) => {
      const u = um.get(r.userId);
      return {
        rank: i + 1,
        userId: r.userId,
        displayName: u?.displayName ?? '?',
        avatarUrl: u?.avatarUrl,
        avatar: u?.selectedAvatar,
        level: u?.level ?? 1,
        value: r._count.id,
        isMe: r.userId === user.id,
      };
    });
  }
}

@ApiTags('shop')
@Controller('shop')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ShopController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: RequestUser) {
    const [items, owned, u] = await Promise.all([
      (this.prisma as any).cosmeticItem.findMany({ orderBy: [{ kind: 'asc' }, { price: 'asc' }] }),
      (this.prisma as any).userItem.findMany({ where: { userId: user.id }, select: { itemId: true } }),
      this.prisma.user.findUnique({ where: { id: user.id }, select: { runCoins: true, selectedAvatar: true, selectedTerritoryColor: true } }),
    ]);
    const ownedIds = new Set(owned.map((o: any) => o.itemId));
    return {
      coins: u?.runCoins ?? 0,
      selected: { avatar: u?.selectedAvatar, territoryColor: u?.selectedTerritoryColor },
      items: items.map((i: any) => ({ ...i, owned: ownedIds.has(i.id) })),
    };
  }

  @Post(':id/buy')
  async buy(@CurrentUser() user: RequestUser, @Param('id') itemId: string) {
    const [item, alreadyOwned, u] = await Promise.all([
      (this.prisma as any).cosmeticItem.findUnique({ where: { id: itemId } }),
      (this.prisma as any).userItem.findUnique({ where: { userId_itemId: { userId: user.id, itemId } } }),
      this.prisma.user.findUnique({ where: { id: user.id }, select: { runCoins: true, isPremium: true } }),
    ]);
    if (!item) return { error: 'NOT_FOUND' };
    if (alreadyOwned) return { error: 'ALREADY_OWNED' };
    if (item.premiumOnly && !u?.isPremium) return { error: 'PREMIUM_REQUIRED' };
    if ((u?.runCoins ?? 0) < item.price) return { error: 'NOT_ENOUGH_COINS' };

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { runCoins: { decrement: item.price } } }),
      (this.prisma as any).userItem.create({ data: { id: crypto.randomUUID(), userId: user.id, itemId } }),
    ]);
    return { ok: true, item };
  }

  @Post(':id/equip')
  async equip(@CurrentUser() user: RequestUser, @Param('id') itemId: string) {
    const item = await (this.prisma as any).cosmeticItem.findUnique({ where: { id: itemId } });
    if (!item) return { error: 'NOT_FOUND' };
    const owned = await (this.prisma as any).userItem.findUnique({ where: { userId_itemId: { userId: user.id, itemId } } });
    if (!owned && item.price > 0) return { error: 'NOT_OWNED' };

    const data: any = {};
    if (item.kind === 'avatar') data.selectedAvatar = item.value;
    if (item.kind === 'territory_color') data.selectedTerritoryColor = item.value;
    await this.prisma.user.update({ where: { id: user.id }, data });
    return { ok: true };
  }
}

@ApiTags('daily')
@Controller('daily')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DailyController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('status')
  async status(@CurrentUser() user: RequestUser) {
    const u = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { lastDailyClaimAt: true, streakDays: true },
    });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const claimed = u?.lastDailyClaimAt && new Date(u.lastDailyClaimAt) >= today;
    return { claimed: !!claimed, streak: u?.streakDays ?? 0 };
  }

  @Post('claim')
  async claim(@CurrentUser() user: RequestUser) {
    const u = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { lastDailyClaimAt: true, streakDays: true },
    });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (u?.lastDailyClaimAt && new Date(u.lastDailyClaimAt) >= today) {
      return { error: 'ALREADY_CLAIMED' };
    }
    const coins = 50 + Math.min((u?.streakDays ?? 0) * 5, 250); // bonus por streak até +250
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastDailyClaimAt: new Date(), runCoins: { increment: coins } },
    });
    return { ok: true, coins };
  }
}

@ApiTags('social')
@Controller('social')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SocialController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('search')
  async search(@CurrentUser() user: RequestUser, @Query('q') q: string) {
    if (!q || q.length < 2) return [];
    return this.prisma.user.findMany({
      where: {
        AND: [
          { id: { not: user.id } },
          { OR: [
            { displayName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ]},
        ],
      },
      take: 20,
      select: { id: true, displayName: true, avatarUrl: true, level: true, selectedAvatar: true, xp: true },
    });
  }

  @Get('following')
  async following(@CurrentUser() user: RequestUser) {
    const rows = await (this.prisma as any).follow.findMany({
      where: { followerId: user.id },
      include: { following: { select: { id: true, displayName: true, level: true, xp: true, selectedAvatar: true } } },
    });
    return rows.map((r: any) => r.following);
  }

  @Get('followers')
  async followers(@CurrentUser() user: RequestUser) {
    const rows = await (this.prisma as any).follow.findMany({
      where: { followingId: user.id },
      include: { follower: { select: { id: true, displayName: true, level: true, xp: true, selectedAvatar: true } } },
    });
    return rows.map((r: any) => r.follower);
  }

  @Post('follow/:userId')
  async follow(@CurrentUser() user: RequestUser, @Param('userId') targetId: string) {
    if (targetId === user.id) return { error: 'SELF' };
    try {
      await (this.prisma as any).follow.create({
        data: { id: crypto.randomUUID(), followerId: user.id, followingId: targetId },
      });
      return { ok: true };
    } catch { return { error: 'ALREADY_FOLLOWING' }; }
  }

  @Post('unfollow/:userId')
  async unfollow(@CurrentUser() user: RequestUser, @Param('userId') targetId: string) {
    await (this.prisma as any).follow.deleteMany({
      where: { followerId: user.id, followingId: targetId },
    });
    return { ok: true };
  }
}

@Module({
  controllers: [BadgesController, LeaderboardController, ShopController, DailyController, SocialController],
  providers: [BadgeUnlockService],
  exports: [BadgeUnlockService],
})
export class GamificationModule {}
