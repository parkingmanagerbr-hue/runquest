export const STRAVA_GATEWAY = Symbol('STRAVA_GATEWAY');

export interface StravaActivity {
  id: number;
  name: string;
  startDate: Date;
  elapsedTimeSec: number;
  movingTimeSec: number;
  distanceMeters: number;
  type: string; // 'Run' | 'TrailRun' | ...
  averagePaceSecPerKm?: number;
  polyline?: string;
}

export interface ExchangeCodeResult {
  athleteId: number;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface StravaGateway {
  authorizeUrl(state: string, callback: string): string;
  exchangeCode(code: string): Promise<ExchangeCodeResult>;
  refresh(refreshToken: string): Promise<RefreshResult>;
  listActivities(accessToken: string, opts: { perPage?: number; after?: Date }): Promise<StravaActivity[]>;
  uploadGpx(accessToken: string, gpxXml: string, name: string): Promise<{ uploadId: number }>;
  deauthorize(accessToken: string): Promise<void>;
}
