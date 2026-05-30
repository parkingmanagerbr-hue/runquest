import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EnsureValidStravaTokenService } from './ensure-valid-token.service';
import { STRAVA_GATEWAY, StravaGateway } from '../domain/strava-gateway';
import { MissionProgressService } from '../../missions/missions.module';
import { TerritoryService } from '../../territories/territories.module';
import { BadgeUnlockService } from '../../gamification/gamification.module';

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
    const token = await (this.prisma as any).stravaToken.findFirst({
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
    const distKm = run.distanceMeters / 1000;
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
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
    const streakMult = 1 + Math.min(newStreak, 7) * 0.05;
    const baseXp = distKm * 10 + run.durationSec / 60 + (distKm > 5 ? 20 : 0);
    const xpGain = Math.round(baseXp * streakMult);
    const coinGain = Math.round(distKm * 10);

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
    let newLevel = updatedUser.level;
    while (updatedUser.xp >= Math.round(100 * Math.pow(newLevel, 1.5))) newLevel++;
    if (newLevel !== updatedUser.level) {
      await this.prisma.user.update({ where: { id: userId }, data: { level: newLevel } });
    }

    await this.missions.applyRun(userId, { distanceMeters: run.distanceMeters, durationSec: run.durationSec });

    // Territórios: decode polyline → coords
    let territoryStats = { visited: 0, newCaptures: 0 };
    if (activity.map?.summary_polyline) {
      try {
        const coords = this.decodePolyline(activity.map.summary_polyline);
        if (coords.length > 0) {
          territoryStats = await this.territories.applyRun(userId, coords);
        }
      } catch {}
    }
    const totalTerritories = await (this.prisma as any).territory.count({
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

  /** Decode Google encoded polyline → [lng, lat][] (GeoJSON) */
  private decodePolyline(str: string): number[][] {
    const coords: number[][] = [];
    let index = 0, lat = 0, lng = 0;
    while (index < str.length) {
      let b, shift = 0, result = 0;
      do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lat += (result & 1) ? ~(result >> 1) : (result >> 1);
      shift = 0; result = 0;
      do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lng += (result & 1) ? ~(result >> 1) : (result >> 1);
      coords.push([lng / 1e5, lat / 1e5]);
    }
    return coords;
  }
}
