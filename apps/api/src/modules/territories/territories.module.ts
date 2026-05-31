import {
  Controller, Get, Injectable, Logger, Module, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { latLngToCell, cellToBoundary, polygonToCells } from 'h3-js';
import { JwtAuthGuard } from '../auth/infrastructure/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../../shared/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { MissionProgressService } from '../missions/missions.module';

const H3_RES = 9; // ~150m por célula
const VISITS_TO_CAPTURE = 3;
const EXPIRY_DAYS = 21;

@Injectable()
export class TerritoryService {
  private readonly logger = new Logger(TerritoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly missions: MissionProgressService,
  ) {}

  /** Após uma run, soma visitas e captura células. Retorna novas conquistadas. */
  async applyRun(userId: string, points: number[][]): Promise<{ visited: number; newCaptures: number }> {
    if (!points || points.length === 0) return { visited: 0, newCaptures: 0 };
    // Coordinates em GeoJSON: [lng, lat]. Para h3 precisa [lat, lng]
    const cells = new Set<string>();
    for (const c of points) {
      try {
        const cell = latLngToCell(c[1], c[0], H3_RES);
        cells.add(cell);
      } catch { /* ponto inválido */ }
    }
    let newCaptures = 0;
    const now = new Date();
    const newExpiry = new Date(now.getTime() + EXPIRY_DAYS * 86400 * 1000);

    for (const h3 of cells) {
      const existing = await this.prisma.territory.findUnique({
        where: { userId_h3Index: { userId, h3Index: h3 } },
      });
      if (existing) {
        const newVisits = existing.visits + 1;
        const justCaptured = !existing.capturedAt && newVisits >= VISITS_TO_CAPTURE;
        await this.prisma.territory.update({
          where: { userId_h3Index: { userId, h3Index: h3 } },
          data: {
            visits: newVisits,
            lastVisitAt: now,
            expiresAt: newExpiry,
            capturedAt: justCaptured ? now : existing.capturedAt,
          },
        });
        if (justCaptured) newCaptures++;
      } else {
        await this.prisma.territory.create({
          data: {
            id: crypto.randomUUID(),
            userId,
            h3Index: h3,
            visits: 1,
            lastVisitAt: now,
            expiresAt: newExpiry,
            capturedAt: null,
          },
        });
      }
    }

    if (newCaptures > 0) {
      await this.missions.incrementTerritoryCapture(userId, newCaptures);
    }
    return { visited: cells.size, newCaptures };
  }
}

@ApiTags('territories')
@Controller('territories')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TerritoriesController {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista todos territórios do user. Cada célula vem com polígono (boundary). */
  @Get('me')
  async myTerritories(@CurrentUser() user: RequestUser) {
    const rows = await this.prisma.territory.findMany({
      where: { userId: user.id },
      orderBy: { lastVisitAt: 'desc' },
    });
    return rows.map(r => ({
      h3: r.h3Index,
      visits: r.visits,
      captured: !!r.capturedAt,
      capturedAt: r.capturedAt,
      expiresAt: r.expiresAt,
      boundary: cellToBoundary(r.h3Index).map(([lat, lng]) => [lat, lng]),
    }));
  }

  @Get('stats')
  async stats(@CurrentUser() user: RequestUser) {
    const all = await this.prisma.territory.findMany({ where: { userId: user.id } });
    const captured = all.filter(t => t.capturedAt).length;
    const totalVisits = all.reduce((a, t) => a + t.visits, 0);
    return { total: all.length, captured, contested: all.length - captured, totalVisits };
  }
}

import { MissionsModule } from '../missions/missions.module';

@Module({
  imports: [MissionsModule],
  controllers: [TerritoriesController],
  providers: [TerritoryService],
  exports: [TerritoryService],
})
export class TerritoriesModule {}
