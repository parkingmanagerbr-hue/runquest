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
    return this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true, email: true, displayName: true, avatarUrl: true,
        isPremium: true, premiumUntil: true, isOwner: true,
        xp: true, level: true, runCoins: true, streakDays: true, lastRunAt: true,
        createdAt: true,
      },
    });
  }
}

@Module({ controllers: [UsersController] })
export class UsersModule {}
