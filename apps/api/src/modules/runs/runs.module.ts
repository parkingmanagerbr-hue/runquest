import {
  Body, Controller, Get, Module, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsISO8601, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/infrastructure/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../../shared/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

class CreateRunDto {
  @IsISO8601() startedAt!: string;
  @IsISO8601() endedAt!: string;
  @IsNumber() @Min(0) distanceMeters!: number;
  @IsInt() @Min(0) durationSec!: number;
  @IsInt() @Min(0) avgPaceSecPerKm!: number;
  @IsOptional() pointsGeoJson?: unknown;
  @IsOptional() @IsString() opId?: string;
  @IsOptional() @IsString() source?: 'GPS' | 'MANUAL';
}

@ApiTags('runs')
@Controller('runs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RunsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateRunDto) {
    if (dto.opId) {
      const existing = await this.prisma.run.findUnique({ where: { opId: dto.opId } });
      if (existing) return existing;
    }
    return this.prisma.run.create({
      data: {
        userId: user.id,
        startedAt: new Date(dto.startedAt),
        endedAt: new Date(dto.endedAt),
        distanceMeters: dto.distanceMeters,
        durationSec: dto.durationSec,
        avgPaceSecPerKm: dto.avgPaceSecPerKm,
        pointsGeoJson: (dto.pointsGeoJson ?? {}) as any,
        source: dto.source ?? 'GPS',
        opId: dto.opId,
      },
    });
  }

  @Get()
  async list(@CurrentUser() user: RequestUser, @Query('limit') limit?: number) {
    return this.prisma.run.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: 'desc' },
      take: Math.min(Number(limit) || 30, 100),
    });
  }
}

@Module({ controllers: [RunsController] })
export class RunsModule {}
