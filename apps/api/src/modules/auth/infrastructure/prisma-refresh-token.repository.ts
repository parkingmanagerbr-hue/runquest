import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RefreshTokenRepository, StoredRefreshToken } from '../domain/refresh-token.repository';

@Injectable()
export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { jti: string; userId: string; expiresAt: Date; userAgent?: string; ip?: string }): Promise<void> {
    await this.prisma.refreshToken.create({ data });
  }
  async findByJti(jti: string): Promise<StoredRefreshToken | null> {
    const r = await this.prisma.refreshToken.findUnique({ where: { jti } });
    return r ? { jti: r.jti, userId: r.userId, expiresAt: r.expiresAt, revokedAt: r.revokedAt } : null;
  }
  async revoke(jti: string): Promise<void> {
    await this.prisma.refreshToken.update({ where: { jti }, data: { revokedAt: new Date() } });
  }
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
