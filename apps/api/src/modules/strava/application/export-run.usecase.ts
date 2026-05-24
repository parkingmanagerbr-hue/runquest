import { Inject, Injectable } from '@nestjs/common';
import { EnsureValidStravaTokenService } from './ensure-valid-token.service';
import { STRAVA_GATEWAY, StravaGateway } from '../domain/strava-gateway';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ExportRunToStravaUseCase {
  constructor(
    private readonly tokens: EnsureValidStravaTokenService,
    @Inject(STRAVA_GATEWAY) private readonly gw: StravaGateway,
    private readonly prisma: PrismaService,
  ) {}

  async execute(userId: string, runId: string): Promise<{ uploadId: number }> {
    const run = await this.prisma.run.findFirst({ where: { id: runId, userId } });
    if (!run) throw new Error('Run not found');
    if (run.stravaActivityId || run.stravaUploadId) {
      throw new Error('Run already exported to Strava');
    }

    const token = await this.tokens.get(userId);
    const gpx = this.buildGpx(run);
    const name = `RunQuest — ${(run.distanceMeters / 1000).toFixed(2)} km`;
    const { uploadId } = await this.gw.uploadGpx(token.accessToken, gpx, name);

    await this.prisma.run.update({
      where: { id: run.id },
      data: { stravaUploadId: BigInt(uploadId) },
    });
    return { uploadId };
  }

  /** Constrói GPX a partir de pointsGeoJson { coordinates: [[lng,lat], ...] }. */
  private buildGpx(run: any): string {
    const startedAt: Date = run.startedAt;
    const durationSec: number = run.durationSec;
    const coords: number[][] = run.pointsGeoJson?.coordinates ?? [];

    const trkpts = coords.length
      ? coords.map((c, i) => {
          const t = new Date(startedAt.getTime() + (i * durationSec * 1000) / Math.max(coords.length - 1, 1));
          return `      <trkpt lat="${c[1]}" lon="${c[0]}"><time>${t.toISOString()}</time></trkpt>`;
        }).join('\n')
      : `      <trkpt lat="-23.5505" lon="-46.6333"><time>${startedAt.toISOString()}</time></trkpt>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RunQuest" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><time>${startedAt.toISOString()}</time></metadata>
  <trk>
    <name>RunQuest — ${(run.distanceMeters / 1000).toFixed(2)} km</name>
    <type>running</type>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
  }
}
