import {
  Controller, Get, Injectable, Logger, Module, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { cellToBoundary } from 'h3-js';
import { JwtAuthGuard } from '../auth/infrastructure/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../../shared/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { MissionProgressService } from '../missions/missions.module';
import { pointsToCells, VISITS_TO_CAPTURE, EXPIRY_DAYS } from './territory-cells';

@Injectable()
export class TerritoryService {
  private readonly logger = new Logger(TerritoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly missions: MissionProgressService,
  ) {}

  /** Após uma run, soma visitas e captura células. Retorna novas conquistadas. */
  async applyRun(userId: string, points: number[][]): Promise<{ visited: number; newCaptures: number }> {
    const cells = pointsToCells(points); // dedup + validação de intervalo (puro, testado)
    if (cells.size === 0) return { visited: 0, newCaptures: 0 };

    let newCaptures = 0;
    const now = new Date();
    const newExpiry = new Date(now.getTime() + EXPIRY_DAYS * 86400 * 1000);

    for (const h3 of cells) {
      // Incremento ATÔMICO (upsert): antes era findUnique→create/update, e dois
      // processos na mesma célula (POST /runs + webhook Strava) achavam ambos
      // `null` e o 2º create lançava P2002, derrubando o request pós-crédito.
      const t = await this.prisma.territory.upsert({
        where: { userId_h3Index: { userId, h3Index: h3 } },
        create: {
          id: crypto.randomUUID(), userId, h3Index: h3,
          visits: 1, lastVisitAt: now, expiresAt: newExpiry, capturedAt: null,
        },
        update: { visits: { increment: 1 }, lastVisitAt: now, expiresAt: newExpiry },
        select: { visits: true, capturedAt: true },
      });

      // Captura ATÔMICA: só o request que virar capturedAt de null→now (count===1)
      // conta a conquista — evita duplo-conteo sob concorrência.
      if (!t.capturedAt && t.visits >= VISITS_TO_CAPTURE) {
        const flip = await this.prisma.territory.updateMany({
          where: { userId, h3Index: h3, capturedAt: null, visits: { gte: VISITS_TO_CAPTURE } },
          data: { capturedAt: now },
        });
        if (flip.count === 1) newCaptures++;
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
