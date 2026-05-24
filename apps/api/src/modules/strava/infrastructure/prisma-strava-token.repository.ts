import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CryptoService } from '../../../shared/kernel/crypto.service';
import { StravaTokenRecord, StravaTokenRepository } from '../domain/strava-token.repository';

@Injectable()
export class PrismaStravaTokenRepository implements StravaTokenRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async save(t: StravaTokenRecord): Promise<void> {
    await this.prisma.stravaToken.upsert({
      where: { userId: t.userId },
      create: {
        userId: t.userId,
        athleteId: t.athleteId,
        accessTokenEnc: this.crypto.encrypt(t.accessToken),
        refreshTokenEnc: this.crypto.encrypt(t.refreshToken),
        expiresAt: t.expiresAt,
        scope: t.scope,
      },
      update: {
        athleteId: t.athleteId,
        accessTokenEnc: this.crypto.encrypt(t.accessToken),
        refreshTokenEnc: this.crypto.encrypt(t.refreshToken),
        expiresAt: t.expiresAt,
        scope: t.scope,
      },
    });
  }

  async findByUserId(userId: string): Promise<StravaTokenRecord | null> {
    const r = await this.prisma.stravaToken.findUnique({ where: { userId } });
    if (!r) return null;
    return {
      userId: r.userId,
      athleteId: r.athleteId,
      accessToken: this.crypto.decrypt(r.accessTokenEnc),
      refreshToken: this.crypto.decrypt(r.refreshTokenEnc),
      expiresAt: r.expiresAt,
      scope: r.scope,
    };
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.prisma.stravaToken.deleteMany({ where: { userId } });
  }
}
