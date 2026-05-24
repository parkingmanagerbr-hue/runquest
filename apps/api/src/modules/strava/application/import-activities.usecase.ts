import { Injectable } from '@nestjs/common';
import { EnsureValidStravaTokenService } from './ensure-valid-token.service';
import { Inject } from '@nestjs/common';
import { STRAVA_GATEWAY, StravaGateway } from '../domain/strava-gateway';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ImportStravaActivitiesUseCase {
  constructor(
    private readonly tokens: EnsureValidStravaTokenService,
    @Inject(STRAVA_GATEWAY) private readonly gw: StravaGateway,
    private readonly prisma: PrismaService,
  ) {}

  async execute(userId: string, opts: { sinceDays?: number } = {}): Promise<{ imported: number; skipped: number }> {
    const token = await this.tokens.get(userId);
    const after = opts.sinceDays
      ? new Date(Date.now() - opts.sinceDays * 86_400_000)
      : new Date(Date.now() - 90 * 86_400_000);

    const activities = await this.gw.listActivities(token.accessToken, { after, perPage: 100 });

    let imported = 0; let skipped = 0;
    for (const a of activities) {
      const existing = await this.prisma.run.findUnique({ where: { stravaActivityId: BigInt(a.id) } });
      if (existing) { skipped++; continue; }
      await this.prisma.run.create({
        data: {
          userId,
          startedAt: a.startDate,
          endedAt: new Date(a.startDate.getTime() + a.elapsedTimeSec * 1000),
          distanceMeters: a.distanceMeters,
          durationSec: a.movingTimeSec,
          avgPaceSecPerKm: a.averagePaceSecPerKm ?? 0,
          pointsGeoJson: a.polyline ? { polyline: a.polyline } as any : {},
          source: 'STRAVA_IMPORT',
          stravaActivityId: BigInt(a.id),
        },
      });
      imported++;
    }
    return { imported, skipped };
  }
}
