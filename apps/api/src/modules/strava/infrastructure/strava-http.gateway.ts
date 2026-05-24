import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  StravaGateway, StravaActivity, ExchangeCodeResult, RefreshResult,
} from '../domain/strava-gateway';

const STRAVA_AUTH = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN = 'https://www.strava.com/oauth/token';
const STRAVA_API = 'https://www.strava.com/api/v3';
const STRAVA_UPLOAD = `${STRAVA_API}/uploads`;
const SCOPE = 'read,activity:read_all,activity:write';

@Injectable()
export class StravaHttpGateway implements StravaGateway {
  private readonly logger = new Logger(StravaHttpGateway.name);

  constructor(private readonly cfg: ConfigService) {}

  private get clientId(): string {
    const v = this.cfg.get<string>('STRAVA_CLIENT_ID');
    if (!v) throw new Error('STRAVA_CLIENT_ID missing');
    return v;
  }
  private get clientSecret(): string {
    const v = this.cfg.get<string>('STRAVA_CLIENT_SECRET');
    if (!v) throw new Error('STRAVA_CLIENT_SECRET missing');
    return v;
  }

  authorizeUrl(state: string, callback: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: callback,
      response_type: 'code',
      approval_prompt: 'auto',
      scope: SCOPE,
      state,
    });
    return `${STRAVA_AUTH}?${params}`;
  }

  async exchangeCode(code: string): Promise<ExchangeCodeResult> {
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      grant_type: 'authorization_code',
    });
    const r = await fetch(STRAVA_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!r.ok) throw new Error(`Strava exchange failed: ${r.status} ${await r.text()}`);
    const d = await r.json() as any;
    return {
      athleteId: Number(d.athlete?.id),
      accessToken: d.access_token,
      refreshToken: d.refresh_token,
      expiresAt: new Date(d.expires_at * 1000),
      scope: SCOPE,
    };
  }

  async refresh(refreshToken: string): Promise<RefreshResult> {
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
    const r = await fetch(STRAVA_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!r.ok) throw new Error(`Strava refresh failed: ${r.status} ${await r.text()}`);
    const d = await r.json() as any;
    return {
      accessToken: d.access_token,
      refreshToken: d.refresh_token,
      expiresAt: new Date(d.expires_at * 1000),
    };
  }

  async listActivities(accessToken: string, opts: { perPage?: number; after?: Date } = {}): Promise<StravaActivity[]> {
    const params = new URLSearchParams({ per_page: String(opts.perPage ?? 30) });
    if (opts.after) params.set('after', String(Math.floor(opts.after.getTime() / 1000)));
    const r = await fetch(`${STRAVA_API}/athlete/activities?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) throw new Error(`Strava list failed: ${r.status} ${await r.text()}`);
    const data = await r.json() as any[];
    return data
      .filter((a) => a.type === 'Run' || a.type === 'TrailRun' || a.type === 'VirtualRun')
      .map((a) => ({
        id: a.id,
        name: a.name,
        startDate: new Date(a.start_date),
        elapsedTimeSec: a.elapsed_time,
        movingTimeSec: a.moving_time,
        distanceMeters: a.distance,
        type: a.type,
        averagePaceSecPerKm: a.distance > 0 ? Math.round((a.moving_time * 1000) / a.distance) : undefined,
        polyline: a.map?.summary_polyline ?? undefined,
      }));
  }

  async uploadGpx(accessToken: string, gpxXml: string, name: string): Promise<{ uploadId: number }> {
    const form = new FormData();
    form.append('file', new Blob([gpxXml], { type: 'application/gpx+xml' }), 'activity.gpx');
    form.append('data_type', 'gpx');
    form.append('name', name);
    form.append('description', 'Sincronizado pelo RunQuest');
    const r = await fetch(STRAVA_UPLOAD, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    if (!r.ok) throw new Error(`Strava upload failed: ${r.status} ${await r.text()}`);
    const d = await r.json() as any;
    return { uploadId: Number(d.id) };
  }

  async deauthorize(accessToken: string): Promise<void> {
    await fetch(`${STRAVA_API}/oauth/deauthorize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }
}
