import { Controller, Module, Post, Headers, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PushService } from './push.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * POST /push/weekly-summary — called by VPS cron every Monday 8am BRT.
 * Secured by CRON_SECRET header. Sends personalised push to all users
 * that have a push subscription and ran at least once in the past 7 days.
 */
@Controller('push')
export class PushController {
  private readonly logger = new Logger(PushController.name);

  constructor(
    private readonly push: PushService,
    private readonly prisma: PrismaService,
    private readonly cfg: ConfigService,
  ) {}

  @Post('weekly-summary')
  async weeklySummary(@Headers('x-cron-secret') secret: string) {
    const expected = this.cfg.get<string>('CRON_SECRET');
    if (!expected || secret !== expected) throw new UnauthorizedException('Invalid cron secret');

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

    type PushUser = { id: string; displayName: string; streakDays: number; runs: { distanceMeters: number; durationSec: number }[] };
    // Fetch all users with push subscription
    const users = (await this.prisma.user.findMany({
      where: { NOT: { pushSubscription: { equals: Prisma.AnyNull } } },
      select: {
        id: true,
        displayName: true,
        streakDays: true,
        runs: {
          where: { startedAt: { gte: weekAgo } },
          select: { distanceMeters: true, durationSec: true },
        },
      },
    })) as unknown as PushUser[];

    let sent = 0;
    let skipped = 0;

    for (const u of users) {
      if (u.runs.length === 0) { skipped++; continue; }

      const totalKm = u.runs.reduce((a, r) => a + r.distanceMeters / 1000, 0);
      const totalMin = Math.round(u.runs.reduce((a, r) => a + r.durationSec, 0) / 60);
      const name = u.displayName.split(' ')[0];

      const streakPart = u.streakDays > 0 ? ` 🔥 ${u.streakDays} dias seguidos!` : '';

      await this.push.sendToUser(u.id, {
        title: `Resumo da semana, ${name}! 🏃`,
        body: `${u.runs.length} corrida${u.runs.length > 1 ? 's' : ''} · ${totalKm.toFixed(1)} km · ${totalMin} min${streakPart}`,
        url: '/app/stats',
      });
      sent++;
    }

    this.logger.log(`Weekly summary sent to ${sent} users, ${skipped} skipped (no runs this week)`);
    return { ok: true, sent, skipped };
  }
}

@Module({
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
