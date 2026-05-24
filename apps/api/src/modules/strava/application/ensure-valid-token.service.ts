import { Inject, Injectable } from '@nestjs/common';
import { STRAVA_TOKEN_REPOSITORY, StravaTokenRepository, StravaTokenRecord } from '../domain/strava-token.repository';
import { STRAVA_GATEWAY, StravaGateway } from '../domain/strava-gateway';

@Injectable()
export class EnsureValidStravaTokenService {
  constructor(
    @Inject(STRAVA_TOKEN_REPOSITORY) private readonly repo: StravaTokenRepository,
    @Inject(STRAVA_GATEWAY) private readonly gw: StravaGateway,
  ) {}

  /** Garante token com >5min de vida; refresha se preciso. Lança se user não conectou. */
  async get(userId: string): Promise<StravaTokenRecord> {
    const t = await this.repo.findByUserId(userId);
    if (!t) throw new Error('Strava not connected');

    const fiveMinFromNow = new Date(Date.now() + 5 * 60_000);
    if (t.expiresAt > fiveMinFromNow) return t;

    const r = await this.gw.refresh(t.refreshToken);
    const updated: StravaTokenRecord = {
      ...t,
      accessToken: r.accessToken,
      refreshToken: r.refreshToken,
      expiresAt: r.expiresAt,
    };
    await this.repo.save(updated);
    return updated;
  }
}
