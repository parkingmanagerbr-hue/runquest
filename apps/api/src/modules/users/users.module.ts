import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/infrastructure/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../../shared/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: RequestUser) {
    const [u, agg] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true, email: true, displayName: true, avatarUrl: true,
          isPremium: true, premiumUntil: true, isOwner: true,
          xp: true, level: true, runCoins: true, streakDays: true,
          longestStreak: true, lastRunAt: true, createdAt: true,
          selectedAvatar: true, selectedTerritoryColor: true,
        },
      }),
      this.prisma.run.aggregate({
        where: { userId: user.id },
        _count: { id: true },
        _sum: { distanceMeters: true },
      }),
    ]);
    return {
      ...u,
      totalRuns: agg._count.id,
      totalDistanceM: agg._sum.distanceMeters ?? 0,
    };
  }
}

@Module({ controllers: [UsersController] })
export class UsersModule {}
