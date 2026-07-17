import {
  Body, Controller, Delete, Get, Module, Param, Post, Put, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, ValidateNested, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/infrastructure/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../../shared/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

class SegmentDto {
  @IsInt() @Min(0) order!: number;
  @IsEnum(['WARMUP', 'INTERVAL_FAST', 'INTERVAL_SLOW', 'TEMPO', 'EASY', 'COOLDOWN', 'REST', 'CUSTOM'])
  kind!: string;
  @IsOptional() @IsInt() durationSec?: number;
  @IsOptional() @IsNumber() distanceM?: number;
  @IsOptional() @IsInt() targetPaceSecPerKm?: number;
  @IsOptional() @IsInt() repeats?: number;
  @IsOptional() @IsString() notes?: string;
}

class CreateWorkoutDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(['INTERVALS', 'TEMPO', 'LONG_RUN', 'EASY', 'RECOVERY', 'RACE', 'CUSTOM'])
  type!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => SegmentDto)
  segments!: SegmentDto[];
}

class StartSessionDto {
  @IsString() workoutId!: string;
  @IsOptional() @IsString() runId?: string;
}

@ApiTags('workouts')
@Controller('workouts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkoutsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: RequestUser) {
    return this.prisma.workout.findMany({
      where: { OR: [{ userId: user.id }, { isTemplate: true }] },
      include: { segments: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get(':id')
  async get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.prisma.workout.findFirst({
      where: { id, OR: [{ userId: user.id }, { isTemplate: true }] },
      include: { segments: { orderBy: { order: 'asc' } } },
    });
  }

  @Post()
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateWorkoutDto) {
    const totalSec = dto.segments.reduce(
      (a, s) => a + (s.durationSec ?? 0) * (s.repeats ?? 1), 0);
    const totalM = dto.segments.reduce(
      (a, s) => a + (s.distanceM ?? 0) * (s.repeats ?? 1), 0);
    return this.prisma.workout.create({
      data: {
        userId: user.id,
        name: dto.name,
        description: dto.description,
        type: dto.type as any,
        totalDurationSec: totalSec,
        totalDistanceM: totalM,
        segments: { create: dto.segments.map(s => ({ ...s, kind: s.kind as any })) },
      },
      include: { segments: true },
    });
  }

  @Put(':id')
  async update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: CreateWorkoutDto) {
    const w = await this.prisma.workout.findFirst({ where: { id, userId: user.id } });
    if (!w) return null;
    const totalSec = dto.segments.reduce((a, s) => a + (s.durationSec ?? 0) * (s.repeats ?? 1), 0);
    const totalM = dto.segments.reduce((a, s) => a + (s.distanceM ?? 0) * (s.repeats ?? 1), 0);
    await this.prisma.workoutSegment.deleteMany({ where: { workoutId: id } });
    return this.prisma.workout.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type as any,
        totalDurationSec: totalSec,
        totalDistanceM: totalM,
        segments: { create: dto.segments.map(s => ({ ...s, kind: s.kind as any })) },
      },
      include: { segments: true },
    });
  }

  @Delete(':id')
  async remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.prisma.workout.deleteMany({ where: { id, userId: user.id } });
    return { ok: true };
  }

  @Post('session/start')
  async startSession(@CurrentUser() user: RequestUser, @Body() dto: StartSessionDto) {
    // Verifica POSSE de workoutId e runId — sem isto, um usuário podia iniciar
    // uma sessão referenciando o treino privado ou a corrida de outro; como
    // WorkoutSession.runId é @unique, ele ainda ocupava o slot da corrida alheia
    // e derrubava (P2002) a sessão legítima do dono.
    const workout = await this.prisma.workout.findFirst({
      where: { id: dto.workoutId, userId: user.id },
      select: { id: true },
    });
    if (!workout) return { error: 'WORKOUT_NOT_FOUND' };

    if (dto.runId) {
      const run = await this.prisma.run.findFirst({
        where: { id: dto.runId, userId: user.id },
        select: { id: true },
      });
      if (!run) return { error: 'RUN_NOT_FOUND' };
    }

    return this.prisma.workoutSession.create({
      data: {
        userId: user.id,
        workoutId: dto.workoutId,
        runId: dto.runId,
        startedAt: new Date(),
      },
    });
  }

  @Post('session/:id/complete')
  async completeSession(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.prisma.workoutSession.updateMany({
      where: { id, userId: user.id },
      data: { completedAt: new Date() },
    });
  }
}

@Module({ controllers: [WorkoutsController] })
export class WorkoutsModule {}
