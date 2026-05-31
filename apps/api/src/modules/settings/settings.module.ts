import {
  Body, Controller, Get, Module, Patch, Post, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsISO8601, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/infrastructure/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../../shared/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

class UpdateSettingsDto {
  @IsOptional() @IsString() displayName?: string;
  @IsOptional() @IsNumber() @Min(30) @Max(300) weightKg?: number;
  @IsOptional() @IsInt() @Min(80) @Max(250) heightCm?: number;
  @IsOptional() @IsISO8601() birthDate?: string;
  @IsOptional() @IsIn(['metric', 'imperial']) units?: string;
  @IsOptional() @IsBoolean() audioCoachEnabled?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(5) audioCoachIntervalKm?: number;
}

class PushSubDto {
  @IsString() endpoint!: string;
  keys!: { p256dh: string; auth: string };
}

@ApiTags('settings')
@Controller('settings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get(@CurrentUser() user: RequestUser) {
    return this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        displayName: true, weightKg: true, heightCm: true, birthDate: true,
        units: true, audioCoachEnabled: true, audioCoachIntervalKm: true,
      } as any,
    });
  }

  @Patch()
  async update(@CurrentUser() user: RequestUser, @Body() dto: UpdateSettingsDto) {
    const data: any = { ...dto };
    if (dto.birthDate) data.birthDate = new Date(dto.birthDate);
    return this.prisma.user.update({ where: { id: user.id }, data, select: { id: true } });
  }

  @Post('push-subscribe')
  async subscribe(@CurrentUser() user: RequestUser, @Body() dto: PushSubDto) {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { pushSubscription: dto as any } as any,
    });
    return { ok: true };
  }

  @Post('push-unsubscribe')
  async unsubscribe(@CurrentUser() user: RequestUser) {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { pushSubscription: null as any } as any,
    });
    return { ok: true };
  }
}

@Module({ controllers: [SettingsController] })
export class SettingsModule {}
