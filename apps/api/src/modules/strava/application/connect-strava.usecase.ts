import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { STRAVA_GATEWAY, StravaGateway } from '../domain/strava-gateway';
import { STRAVA_TOKEN_REPOSITORY, StravaTokenRepository } from '../domain/strava-token.repository';

@Injectable()
export class ConnectStravaUseCase {
  // state em memória (TTL 10min). Em produção usar Redis.
  private states = new Map<string, { userId: string; expiresAt: number }>();

  constructor(
    @Inject(STRAVA_GATEWAY) private readonly gw: StravaGateway,
    @Inject(STRAVA_TOKEN_REPOSITORY) private readonly repo: StravaTokenRepository,
    private readonly cfg: ConfigService,
  ) {}

  private callback(): string {
    return this.cfg.get<string>('STRAVA_CALLBACK_URL')
      ?? 'https://runquest.veloxisit.com.br/api/strava/callback';
  }

  beginAuth(userId: string): string {
    this.gc();
    const state = randomBytes(24).toString('hex');
    this.states.set(state, { userId, expiresAt: Date.now() + 10 * 60_000 });
    return this.gw.authorizeUrl(state, this.callback());
  }

  async handleCallback(code: string, state: string): Promise<{ userId: string; athleteId: number }> {
    const s = this.states.get(state);
    if (!s || s.expiresAt < Date.now()) throw new Error('Invalid or expired state');
    this.states.delete(state);

    const r = await this.gw.exchangeCode(code);
    await this.repo.save({
      userId: s.userId,
      athleteId: BigInt(r.athleteId),
      accessToken: r.accessToken,
      refreshToken: r.refreshToken,
      expiresAt: r.expiresAt,
      scope: r.scope,
    });
    return { userId: s.userId, athleteId: r.athleteId };
  }

  async disconnect(userId: string): Promise<void> {
    const t = await this.repo.findByUserId(userId);
    if (t) {
      try { await this.gw.deauthorize(t.accessToken); } catch { /* best-effort */ }
      await this.repo.deleteByUserId(userId);
    }
  }

  private gc(): void {
    const now = Date.now();
    for (const [k, v] of this.states) if (v.expiresAt < now) this.states.delete(k);
  }
}
