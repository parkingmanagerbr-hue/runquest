export const STRAVA_TOKEN_REPOSITORY = Symbol('STRAVA_TOKEN_REPOSITORY');

export interface StravaTokenRecord {
  userId: string;
  athleteId: bigint;
  accessToken: string;   // decifrado em memória
  refreshToken: string;  // decifrado em memória
  expiresAt: Date;
  scope: string;
}

export interface StravaTokenRepository {
  save(t: StravaTokenRecord): Promise<void>;
  findByUserId(userId: string): Promise<StravaTokenRecord | null>;
  deleteByUserId(userId: string): Promise<void>;
}
