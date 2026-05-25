import {
  Controller, Get, Module, Param, Post, UseGuards, Logger, Injectable,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/infrastructure/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../../shared/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Aplica progresso de missões após uma corrida.
 * Increments distance_km / runs_count / duration_min para missões DAILY/WEEKLY ativas.
 */
@Injectable()
export class MissionProgressService {
  private readonly logger = new Logger(MissionProgressService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Janela atual baseada no scope. */
  private windowOf(scope: 'DAILY' | 'WEEKLY'): { start: Date; end: Date } {
    const now = new Date();
    if (scope === 'DAILY') {
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 1);
      return { start, end };
    }
    // WEEKLY: segunda 00:00 BRT
    const day = now.getDay(); // 0=Dom .. 1=Seg
    const diff = day === 0 ? -6 : 1 - day;
    const start = new Date(now); start.setDate(start.getDate() + diff); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 7);
    return { start, end };
  }

  /** Reset progresso quando assignedAt fora da janela. */
  private async ensureProgress(userId: string, mission: { id: string; scope: string }): Promise<void> {
    const window = this.windowOf(mission.scope as 'DAILY' | 'WEEKLY');
    const existing = await this.prisma.missionProgress.findUnique({
      where: { userId_missionId: { userId, missionId: mission.id } },
    });
    if (!existing) {
      await this.prisma.missionProgress.create({
        data: { id: crypto.randomUUID(), userId, missionId: mission.id, progress: 0, completed: false, claimed: false },
      });
    } else if (existing.assignedAt < window.start) {
      // reset para nova janela
      await this.prisma.missionProgress.update({
        where: { userId_missionId: { userId, missionId: mission.id } },
        data: { progress: 0, completed: false, claimed: false, completedAt: null, claimedAt: null, assignedAt: new Date() },
      });
    }
  }

  /** Após criar uma run, atualiza progresso de todas missões ativas do user. */
  async applyRun(userId: string, run: { distanceMeters: number; durationSec: number }): Promise<void> {
    const missions = await this.prisma.mission.findMany({
      where: { scope: { in: ['DAILY', 'WEEKLY'] } },
    });
    for (const m of missions) {
      await this.ensureProgress(userId, m);
      let inc = 0;
      switch (m.goalKind) {
        case 'runs_count': inc = 1; break;
        case 'distance_km': inc = run.distanceMeters / 1000; break;
        case 'duration_min': inc = run.durationSec / 60; break;
        default: continue; // territory_capture é incrementado em outro lugar
      }
      const prog = await this.prisma.missionProgress.findUnique({
        where: { userId_missionId: { userId, missionId: m.id } },
      });
      if (!prog || prog.claimed) continue;
      const newProg = (prog.progress ?? 0) + inc;
      const completed = newProg >= m.goalValue;
      await this.prisma.missionProgress.update({
        where: { userId_missionId: { userId, missionId: m.id } },
        data: {
          progress: newProg,
          completed,
          completedAt: completed && !prog.completed ? new Date() : prog.completedAt,
        },
      });
    }
  }

  /** Apenas incrementa o goal de captura de territórios (chamado pelo TerritoryService). */
  async incrementTerritoryCapture(userId: string, count = 1): Promise<void> {
    const missions = await this.prisma.mission.findMany({
      where: { goalKind: 'territory_capture' },
    });
    for (const m of missions) {
      await this.ensureProgress(userId, m);
      const prog = await this.prisma.missionProgress.findUnique({
        where: { userId_missionId: { userId, missionId: m.id } },
      });
      if (!prog || prog.claimed) continue;
      const newProg = (prog.progress ?? 0) + count;
      const completed = newProg >= m.goalValue;
      await this.prisma.missionProgress.update({
        where: { userId_missionId: { userId, missionId: m.id } },
        data: { progress: newProg, completed, completedAt: completed && !prog.completed ? new Date() : prog.completedAt },
      });
    }
  }
}

@ApiTags('missions')
@Controller('missions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MissionsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progressService: MissionProgressService,
  ) {}

  @Get()
  async list(@CurrentUser() user: RequestUser) {
    // Garantir progresso para cada missão (cria registros se faltar)
    const missions = await this.prisma.mission.findMany({
      orderBy: [{ scope: 'asc' }, { goalValue: 'asc' }],
    });
    for (const m of missions) await this.progressService['ensureProgress'](user.id, m);

    const progress = await this.prisma.missionProgress.findMany({
      where: { userId: user.id, missionId: { in: missions.map(m => m.id) } },
    });
    const progByMission = new Map(progress.map(p => [p.missionId, p]));
    return missions.map(m => {
      const p = progByMission.get(m.id);
      return {
        id: m.id,
        code: m.code,
        title: m.title,
        description: m.description,
        scope: m.scope,
        goalKind: m.goalKind,
        goalValue: m.goalValue,
        xpReward: m.xpReward,
        coinReward: m.coinReward,
        progress: p?.progress ?? 0,
        completed: p?.completed ?? false,
        claimed: p?.claimed ?? false,
        pct: Math.min(100, Math.round(((p?.progress ?? 0) / m.goalValue) * 100)),
      };
    });
  }

  @Post(':id/claim')
  async claim(@CurrentUser() user: RequestUser, @Param('id') missionId: string) {
    const prog = await this.prisma.missionProgress.findUnique({
      where: { userId_missionId: { userId: user.id, missionId } },
      include: { mission: true },
    });
    if (!prog) return { error: 'NOT_FOUND' };
    if (!prog.completed) return { error: 'NOT_COMPLETED' };
    if (prog.claimed) return { error: 'ALREADY_CLAIMED' };

    await this.prisma.$transaction([
      this.prisma.missionProgress.update({
        where: { userId_missionId: { userId: user.id, missionId } },
        data: { claimed: true, claimedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { xp: { increment: prog.mission.xpReward }, runCoins: { increment: prog.mission.coinReward } },
      }),
    ]);
    return { ok: true, xp: prog.mission.xpReward, coins: prog.mission.coinReward };
  }
}

@Module({
  controllers: [MissionsController],
  providers: [MissionProgressService],
  exports: [MissionProgressService],
})
export class MissionsModule {}
