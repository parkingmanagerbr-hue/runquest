import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ImportStravaActivitiesUseCase } from './import-activities.usecase';

/**
 * Scheduler in-process: roda import diário para todos users com Strava conectado.
 * Failsafe se webhook falhar. Executa às 4h BRT (= 7h UTC).
 *
 * Para escala >10k users mover pra BullMQ. Hoje: setInterval simples.
 */
@Injectable()
export class StravaSyncScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StravaSyncScheduler.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly importUc: ImportStravaActivitiesUseCase,
  ) {}

  onModuleInit() {
    // checa a cada hora se já passou das 7h UTC desde último sync
    this.timer = setInterval(() => this.tick(), 60 * 60 * 1000);
    // primeiro tick após 30s do boot
    setTimeout(() => this.tick(), 30_000);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    const now = new Date();
    // Só roda entre 7h e 8h UTC (4h BRT)
    if (now.getUTCHours() !== 7) return;

    const tokens = await this.prisma.stravaToken.findMany({ select: { userId: true } });
    this.logger.log(`Auto-sync start — ${tokens.length} users com Strava conectado`);
    for (const t of tokens) {
      try {
        const r = await this.importUc.execute(t.userId, { sinceDays: 2 });
        if (r.imported > 0) this.logger.log(`User ${t.userId.slice(0, 8)}: +${r.imported} atividades`);
      } catch (e: any) {
        this.logger.warn(`Sync ${t.userId.slice(0, 8)} failed: ${e.message}`);
      }
    }
    this.logger.log(`Auto-sync done`);
  }
}
