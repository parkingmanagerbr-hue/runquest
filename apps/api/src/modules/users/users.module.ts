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
    const u = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true, email: true, displayName: true, avatarUrl: true,
        isPremium: true, premiumUntil: true, createdAt: true,
      },
    });
    return u;
  }
}

@Module({ controllers: [UsersController] })
export class UsersModule {}
