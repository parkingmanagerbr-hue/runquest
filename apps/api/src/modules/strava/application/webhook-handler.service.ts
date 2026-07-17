import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EnsureValidStravaTokenService } from './ensure-valid-token.service';
import { STRAVA_GATEWAY, StravaGateway } from '../domain/strava-gateway';
import { MissionProgressService } from '../../missions/missions.module';
import { ChallengeProgressService } from '../../challenges/challenges.module';
import { GoalProgressService } from '../../goals/goals.module';
import { TerritoryService } from '../../territories/territories.module';
import { BadgeUnlockService } from '../../gamification/gamification.module';
import { computeStreak, computeRunRewards, levelForXp } from '../../runs/run-rewards';
import { decodePolyline } from '../domain/polyline';

/**
 * Handler para webhooks do Strava.
 * Quando recebe `aspect_type=create`, busca a atividade via API e cria Run automaticamente.
 * Reaproveita o post-run processor (XP + missões + territórios + badges).
 */
@Injectable()
export class StravaWebhookHandler {
  private readonly logger = new Logger(StravaWebhookHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: EnsureValidStravaTokenService,
    @Inject(STRAVA_GATEWAY) private readonly gw: StravaGateway,
    private readonly missions: MissionProgressService,
    private readonly challenges: ChallengeProgressService,
    private readonly goals: GoalProgressService,
    private readonly territories: TerritoryService,
    private readonly badges: BadgeUnlockService,
  ) {}

  async handle(payload: {
    aspect_type: 'create' | 'update' | 'delete';
    event_time: number;
    object_id: number;
    object_type: 'activity' | 'athlete';
    owner_id: number;
    subscription_id: number;
    updates?: Record<string, any>;
  }): Promise<{ ok: boolean; runId?: string; skipped?: string }> {
    // Idempotência: registra evento no DB
    const eventId = `strava-${payload.object_id}-${payload.event_time}-${payload.aspect_type}`;
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { provider_externalId: { provider: 'strava', externalId: eventId } },
    });
    if (existing?.processedAt) {
      this.logger.log(`Webhook ${eventId} já processado, skip`);
      return { ok: true, skipped: 'duplicate' };
    }
    await this.prisma.webhookEvent.upsert({
      where: { provider_externalId: { provider: 'strava', externalId: eventId } },
      create: { provider: 'strava', externalId: eventId, payload: payload as any },
      update: { payload: payload as any },
    });

    // Só trata create de atividade — ignora athlete deauth e updates
    if (payload.object_type !== 'activity' || payload.aspect_type !== 'create') {
      await this.markProcessed(eventId);
      return { ok: true, skipped: payload.aspect_type };
    }

    // Achar o user pelo athleteId
    const token = await this.prisma.stravaToken.findFirst({
      where: { athleteId: BigInt(payload.owner_id) },
    });
    if (!token) {
      this.logger.warn(`No user for athlete ${payload.owner_id}`);
      await this.markProcessed(eventId);
      return { ok: true, skipped: 'no_user' };
    }

    // Verifica se já existe Run com esse stravaActivityId
    const existingRun = await this.prisma.run.findUnique({
      where: { stravaActivityId: BigInt(payload.object_id) },
    });
    if (existingRun) {
      this.logger.log(`Run ${existingRun.id} já existe para activity ${payload.object_id}`);
      await this.markProcessed(eventId);
      return { ok: true, runId: existingRun.id, skipped: 'duplicate_run' };
    }

    // Garante token válido + busca atividade
    const validToken = await this.tokens.get(token.userId);
    let activity: any;
    try {
      const r = await fetch(`https://www.strava.com/api/v3/activities/${payload.object_id}`, {
        headers: { Authorization: `Bearer ${validToken.accessToken}` },
      });
      if (!r.ok) {
        this.logger.error(`Strava get activity failed: ${r.status}`);
        await this.markProcessed(eventId);
        return { ok: true, skipped: 'fetch_error' };
      }
      activity = await r.json();
    } catch (e: any) {
      this.logger.error(`Fetch error: ${e.message}`);
      return { ok: false };
    }

    // Filtra: só running activities
    if (!['Run', 'TrailRun', 'VirtualRun'].includes(activity.type)) {
      await this.markProcessed(eventId);
      return { ok: true, skipped: `type_${activity.type}` };
    }

    // Cria Run + post-process
    const pace = activity.distance > 0
      ? Math.round((activity.moving_time * 1000) / activity.distance)
      : 0;
    const startedAt = new Date(activity.start_date);
    const endedAt = new Date(startedAt.getTime() + activity.elapsed_time * 1000);

    const run = await this.prisma.run.create({
      data: {
        userId: token.userId,
        startedAt,
        endedAt,
        distanceMeters: activity.distance,
        durationSec: activity.moving_time,
        avgPaceSecPerKm: pace,
        pointsGeoJson: activity.map?.summary_polyline
          ? { polyline: activity.map.summary_polyline } as any
          : {} as any,
        source: 'STRAVA_IMPORT',
        stravaActivityId: BigInt(payload.object_id),
      },
    });

    // Reuso da lógica de post-run (XP + streak + missões + territórios + badges)
    await this.applyPostRun(token.userId, run, activity);

    await this.markProcessed(eventId);
    this.logger.log(`✓ Imported activity ${payload.object_id} as run ${run.id}`);
    return { ok: true, runId: run.id };
  }

  private async markProcessed(eventId: string) {
    await this.prisma.webhookEvent.update({
      where: { provider_externalId: { provider: 'strava', externalId: eventId } },
      data: { processedAt: new Date() },
    });
  }

  private async applyPostRun(userId: string, run: any, activity: any) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { lastRunAt: true, streakDays: true, longestStreak: true } as any,
    }) as any;

    // Mesma mecânica pura do RunsService (streak sem NaN, XP/moedas idênticos).
    const newStreak = computeStreak(u?.lastRunAt ? new Date(u.lastRunAt) : null, new Date(), u?.streakDays ?? 0);
    const longestStreak = Math.max(u?.longestStreak ?? 0, newStreak);
    const { xpGain, coinGain } = computeRunRewards(run.distanceMeters, run.durationSec, newStreak);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        xp: { increment: xpGain },
        runCoins: { increment: coinGain },
        lastRunAt: new Date(),
        streakDays: newStreak,
        longestStreak,
        totalRuns: { increment: 1 },
        totalDistanceM: { increment: run.distanceMeters },
      } as any,
    });
    const newLevel = levelForXp(updatedUser.xp, updatedUser.level);
    if (newLevel !== updatedUser.level) {
      await this.prisma.user.update({ where: { id: userId }, data: { level: newLevel } });
    }

    // Missões + Desafios + Goals — mesma tríade do fluxo de corrida manual.
    const progressArg = { distanceMeters: run.distanceMeters, durationSec: run.durationSec };
    await this.missions.applyRun(userId, progressArg);
    await this.challenges.applyRun(userId, progressArg);
    await this.goals.applyRun(userId, progressArg);

    // Territórios: decode polyline → coords
    let territoryStats = { visited: 0, newCaptures: 0 };
    if (activity.map?.summary_polyline) {
      try {
        const coords = decodePolyline(activity.map.summary_polyline);
        if (coords.length > 0) {
          territoryStats = await this.territories.applyRun(userId, coords);
        }
      } catch {}
    }
    if (territoryStats.newCaptures > 0) {
      this.logger.log(`Strava run: ${territoryStats.newCaptures} novos territórios (${territoryStats.visited} visitados) p/ user ${userId}`);
    }
    const totalTerritories = await this.prisma.territory.count({
      where: { userId, capturedAt: { not: null } },
    });

    await this.badges.checkAndUnlock(userId, {
      totalRuns: (updatedUser as any).totalRuns,
      totalDistanceM: (updatedUser as any).totalDistanceM,
      streak: newStreak,
      level: newLevel,
      territories: totalTerritories,
      singleRunDistanceM: run.distanceMeters,
      singleRunPaceSecPerKm: run.avgPaceSecPerKm,
    });
  }
}
