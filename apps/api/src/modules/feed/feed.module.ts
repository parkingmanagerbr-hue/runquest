import {
  Body, Controller, Delete, Get, Module, Param, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/infrastructure/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../../shared/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { PushModule } from '../push/push.module';
import { PushService } from '../push/push.service';

class CommentDto {
  @IsString() @MaxLength(500) text!: string;
}

@ApiTags('feed')
@Controller('feed')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FeedController {
  constructor(private readonly prisma: PrismaService) {}

  /** Atividades dos usuários que você segue + suas próprias. */
  @Get()
  async list(@CurrentUser() user: RequestUser, @Query('limit') limit?: number) {
    const follows = await (this.prisma as any).follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    });
    const ids = [user.id, ...follows.map((f: any) => f.followingId)];

    const runs = await this.prisma.run.findMany({
      where: { userId: { in: ids } },
      orderBy: { startedAt: 'desc' },
      take: Math.min(Number(limit) || 30, 50),
      include: {
        user: { select: { id: true, displayName: true, selectedAvatar: true, level: true } },
        kudos: { select: { userId: true } },
        comments: { take: 3, orderBy: { createdAt: 'desc' }, include: { user: { select: { displayName: true, selectedAvatar: true } } } },
      } as any,
    });

    return runs.map((r: any) => ({
      ...r,
      kudosCount: r.kudos.length,
      youKudoed: r.kudos.some((k: any) => k.userId === user.id),
      commentsCount: r.comments.length,
    }));
  }
}

@ApiTags('kudos')
@Controller('runs/:runId/kudos')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class KudosController {
  constructor(private readonly prisma: PrismaService, private readonly push: PushService) {}

  @Post()
  async kudo(@CurrentUser() user: RequestUser, @Param('runId') runId: string) {
    try {
      await (this.prisma as any).kudo.create({
        data: { id: crypto.randomUUID(), runId, userId: user.id },
      });
    } catch { /* ignora dup */ }

    // Notificação pro dono da run
    const run = await this.prisma.run.findUnique({ where: { id: runId }, select: { userId: true } });
    if (run && run.userId !== user.id) {
      const me = await this.prisma.user.findUnique({ where: { id: user.id }, select: { displayName: true } });
      const title = `${me?.displayName ?? 'Alguém'} curtiu sua corrida`;
      await (this.prisma as any).notification.create({
        data: {
          id: crypto.randomUUID(),
          userId: run.userId,
          type: 'kudo',
          title,
          data: { runId, byUserId: user.id },
        },
      });
      this.push.sendToUser(run.userId, { title, body: '❤️ Abra o RunQuest para ver', url: `/app/runs/${runId}` }).catch(() => {});
    }
    return { ok: true };
  }

  @Delete()
  async unkudo(@CurrentUser() user: RequestUser, @Param('runId') runId: string) {
    await (this.prisma as any).kudo.deleteMany({ where: { runId, userId: user.id } });
    return { ok: true };
  }
}

@ApiTags('comments')
@Controller('runs/:runId/comments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CommentsController {
  constructor(private readonly prisma: PrismaService, private readonly push: PushService) {}

  @Get()
  async list(@Param('runId') runId: string) {
    return (this.prisma as any).runComment.findMany({
      where: { runId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { displayName: true, selectedAvatar: true, level: true } } },
    });
  }

  @Post()
  async create(
    @CurrentUser() user: RequestUser,
    @Param('runId') runId: string,
    @Body() dto: CommentDto,
  ) {
    const c = await (this.prisma as any).runComment.create({
      data: { id: crypto.randomUUID(), runId, userId: user.id, text: dto.text },
      include: { user: { select: { displayName: true, selectedAvatar: true, level: true } } },
    });
    const run = await this.prisma.run.findUnique({ where: { id: runId }, select: { userId: true } });
    if (run && run.userId !== user.id) {
      const me = await this.prisma.user.findUnique({ where: { id: user.id }, select: { displayName: true } });
      const title = `${me?.displayName ?? 'Alguém'} comentou: ${dto.text.slice(0, 80)}`;
      await (this.prisma as any).notification.create({
        data: {
          id: crypto.randomUUID(),
          userId: run.userId,
          type: 'comment',
          title,
          data: { runId, byUserId: user.id },
        },
      });
      this.push.sendToUser(run.userId, { title, body: '💬 Toque para ver o comentário', url: `/app/runs/${runId}` }).catch(() => {});
    }
    return c;
  }
}

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: RequestUser, @Query('limit') limit?: number) {
    return (this.prisma as any).notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit) || 30, 100),
    });
  }

  @Get('unread-count')
  async unread(@CurrentUser() user: RequestUser) {
    const count = await (this.prisma as any).notification.count({
      where: { userId: user.id, readAt: null },
    });
    return { count };
  }

  @Post('mark-read')
  async markRead(@CurrentUser() user: RequestUser) {
    await (this.prisma as any).notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}

@Module({
  imports: [PushModule],
  controllers: [FeedController, KudosController, CommentsController, NotificationsController],
})
export class FeedModule {}
