import {
  Controller, Get, Module, Param, Post, UseGuards, Logger, Injectable,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/infrastructure/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../../shared/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Aplica progresso de DESAFIOS após uma corrida.
 *
 * Diferente das missões: o usuário precisa ter entrado (join) no desafio e a
 * corrida precisa cair dentro da janela [startsAt, endsAt]. Increments por
 * goalKind (distance_km / runs_count / duration_min).
 */
@Injectable()
export class ChallengeProgressService {
  private readonly logger = new Logger(ChallengeProgressService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Após criar uma run, atualiza o progresso dos desafios ativos em que o user participa. */
  async applyRun(userId: string, run: { distanceMeters: number; durationSec: number }): Promise<void> {
    const now = new Date();
    // Participações ativas (não resgatadas) cujo desafio está dentro da janela.
    const parts = await this.prisma.challengeParticipant.findMany({
      where: {
        userId,
        claimed: false,
        challenge: { active: true, startsAt: { lte: now }, endsAt: { gte: now } },
      },
      include: { challenge: true },
    });

    for (const p of parts) {
      let inc = 0;
      switch (p.challenge.goalKind) {
        case 'runs_count': inc = 1; break;
        case 'distance_km': inc = run.distanceMeters / 1000; break;
        case 'duration_min': inc = run.durationSec / 60; break;
        default: continue;
      }
      const newProg = (p.progress ?? 0) + inc;
      const completed = newProg >= p.challenge.goalValue;
      await this.prisma.challengeParticipant.update({
        where: { userId_challengeId: { userId, challengeId: p.challengeId } },
        data: {
          progress: newProg,
          completed,
          completedAt: completed && !p.completed ? new Date() : p.completedAt,
        },
      });
    }
  }
}

@ApiTags('challenges')
@Controller('challenges')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChallengesController {
  constructor(private readonly prisma: PrismaService) {}

  /** Status temporal do desafio em relação a agora. */
  private statusOf(c: { startsAt: Date; endsAt: Date }, now: Date): 'upcoming' | 'active' | 'ended' {
    if (now < c.startsAt) return 'upcoming';
    if (now > c.endsAt) return 'ended';
    return 'active';
  }

  /** GET /challenges — desafios ativos/futuros + a participação do usuário. */
  @Get()
  async list(@CurrentUser() user: RequestUser) {
    const now = new Date();
    const challenges = await this.prisma.challenge.findMany({
      where: { active: true, endsAt: { gte: now } },
      orderBy: [{ startsAt: 'asc' }],
      include: {
        _count: { select: { participants: true } },
        participants: { where: { userId: user.id } },
      },
    });

    return challenges.map(c => {
      const mine = c.participants[0];
      const pct = mine ? Math.min(100, Math.round(((mine.progress ?? 0) / c.goalValue) * 100)) : 0;
      return {
        id: c.id,
        code: c.code,
        title: c.title,
        description: c.description,
        goalKind: c.goalKind,
        goalValue: c.goalValue,
        xpReward: c.xpReward,
        coinReward: c.coinReward,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        status: this.statusOf(c, now),
        participantCount: c._count.participants,
        joined: !!mine,
        progress: mine?.progress ?? 0,
        completed: mine?.completed ?? false,
        claimed: mine?.claimed ?? false,
        pct,
      };
    });
  }

  /** POST /challenges/:id/join — entra no desafio. */
  @Post(':id/join')
  async join(@CurrentUser() user: RequestUser, @Param('id') challengeId: string) {
    const now = new Date();
    const challenge = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge || !challenge.active) return { error: 'NOT_FOUND' };
    if (now > challenge.endsAt) return { error: 'ENDED' };

    const existing = await this.prisma.challengeParticipant.findUnique({
      where: { userId_challengeId: { userId: user.id, challengeId } },
    });
    if (existing) return { ok: true, alreadyJoined: true };

    await this.prisma.challengeParticipant.create({
      data: { userId: user.id, challengeId, progress: 0, completed: false, claimed: false },
    });
    return { ok: true };
  }

  /** POST /challenges/:id/claim — resgata XP + RunCoins ao completar. */
  @Post(':id/claim')
  async claim(@CurrentUser() user: RequestUser, @Param('id') challengeId: string) {
    const part = await this.prisma.challengeParticipant.findUnique({
      where: { userId_challengeId: { userId: user.id, challengeId } },
      include: { challenge: true },
    });
    if (!part) return { error: 'NOT_JOINED' };
    if (!part.completed) return { error: 'NOT_COMPLETED' };
    if (part.claimed) return { error: 'ALREADY_CLAIMED' };

    // Resgate ATÔMICO (ver missions.claim): a guarda claimed=false vai para o
    // WHERE do updateMany; só o vencedor (count === 1) recebe a recompensa.
    const credited = await this.prisma.$transaction(async (tx) => {
      const flip = await tx.challengeParticipant.updateMany({
        where: { userId: user.id, challengeId, completed: true, claimed: false },
        data: { claimed: true, claimedAt: new Date() },
      });
      if (flip.count === 0) return false;
      await tx.user.update({
        where: { id: user.id },
        data: {
          xp: { increment: part.challenge.xpReward },
          runCoins: { increment: part.challenge.coinReward },
        },
      });
      return true;
    });
    if (!credited) return { error: 'ALREADY_CLAIMED' };
    return { ok: true, xp: part.challenge.xpReward, coins: part.challenge.coinReward };
  }

  /** GET /challenges/:id/leaderboard — ranking dos participantes por progresso. */
  @Get(':id/leaderboard')
  async leaderboard(@CurrentUser() user: RequestUser, @Param('id') challengeId: string) {
    const parts = await this.prisma.challengeParticipant.findMany({
      where: { challengeId },
      orderBy: [{ progress: 'desc' }, { completedAt: 'asc' }],
      take: 100,
      include: { user: { select: { id: true, displayName: true, avatarUrl: true, selectedAvatar: true } } },
    });

    return parts.map((p, i) => ({
      rank: i + 1,
      userId: p.user.id,
      displayName: p.user.displayName,
      avatarUrl: p.user.avatarUrl,
      selectedAvatar: p.user.selectedAvatar,
      progress: p.progress,
      completed: p.completed,
      isMe: p.user.id === user.id,
    }));
  }
}

@Module({
  controllers: [ChallengesController],
  providers: [ChallengeProgressService],
  exports: [ChallengeProgressService],
})
export class ChallengesModule {}
