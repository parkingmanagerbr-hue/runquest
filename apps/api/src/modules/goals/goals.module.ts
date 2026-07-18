import {
  Body, Controller, Delete, Get, Injectable, Module, Param, Post, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsNumber, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/infrastructure/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../../shared/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { periodWindow, Period } from '../../shared/kernel/date-window';
import { applyProgress } from '../../shared/kernel/progress';

class CreateGoalDto {
  @IsIn(['distance_km', 'runs_count', 'duration_min']) kind!: string;
  @IsIn(['WEEKLY', 'MONTHLY', 'YEARLY']) period!: string;
  @IsNumber() @Min(0.1) target!: number;
}

@Injectable()
export class GoalProgressService {
  constructor(private readonly prisma: PrismaService) {}

  /** Janela atual do período (data-math pura, compartilhada e testada). */
  windowOf(period: string): { start: Date; end: Date } {
    return periodWindow(period as Period, new Date());
  }

  /** Aplica progresso pós-run. */
  async applyRun(userId: string, run: { distanceMeters: number; durationSec: number }) {
    const goals = await this.prisma.goal.findMany({
      where: { userId, completed: false, windowEnd: { gt: new Date() } },
    });
    for (const g of goals) {
      const { progress, completed } = applyProgress(g.kind, g.progress ?? 0, g.target, run);
      await this.prisma.goal.update({
        where: { id: g.id },
        data: { progress, completed, completedAt: completed ? new Date() : null },
      });
    }
  }
}

@ApiTags('goals')
@Controller('goals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GoalsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly svc: GoalProgressService,
  ) {}

  @Get()
  async list(@CurrentUser() user: RequestUser) {
    return this.prisma.goal.findMany({
      where: { userId: user.id, windowEnd: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post()
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateGoalDto) {
    const w = this.svc.windowOf(dto.period);
    // Calcular progresso atual pelas runs já feitas na janela
    let progress = 0;
    if (dto.kind === 'distance_km' || dto.kind === 'duration_min') {
      const sum = await this.prisma.run.aggregate({
        where: { userId: user.id, startedAt: { gte: w.start, lt: w.end } },
        _sum: { distanceMeters: true, durationSec: true },
      });
      progress = dto.kind === 'distance_km'
        ? (sum._sum.distanceMeters ?? 0) / 1000
        : (sum._sum.durationSec ?? 0) / 60;
    } else {
      progress = await this.prisma.run.count({
        where: { userId: user.id, startedAt: { gte: w.start, lt: w.end } },
      });
    }
    return this.prisma.goal.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        kind: dto.kind,
        period: dto.period,
        target: dto.target,
        progress,
        windowStart: w.start,
        windowEnd: w.end,
        completed: progress >= dto.target,
      },
    });
  }

  @Delete(':id')
  async remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.prisma.goal.deleteMany({ where: { id, userId: user.id } });
    return { ok: true };
  }
}

@Module({
  controllers: [GoalsController],
  providers: [GoalProgressService],
  exports: [GoalProgressService],
})
export class GoalsModule {}
