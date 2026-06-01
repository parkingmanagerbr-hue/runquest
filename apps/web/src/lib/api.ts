const API = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (init.auth !== false) {
    const at = typeof window !== 'undefined' ? localStorage.getItem('rq.at') : null;
    if (at) headers.set('Authorization', `Bearer ${at}`);
  }
  const res = await fetch(`${API}${path}`, { ...init, headers, cache: 'no-store' });
  const txt = await res.text();
  const body = txt ? JSON.parse(txt) : null;
  if (!res.ok) throw new ApiError(body?.message ?? res.statusText, res.status, body?.error);
  return body as T;
}

export const api = {
  register: (data: { email: string; password: string; displayName: string }) =>
    request<{ accessToken: string; refreshToken: string; user: any }>(
      '/auth/register', { method: 'POST', body: JSON.stringify(data), auth: false },
    ),
  login: (data: { email: string; password: string }) =>
    request<{ accessToken: string; refreshToken: string }>(
      '/auth/login', { method: 'POST', body: JSON.stringify(data), auth: false },
    ),
  me: () => request<{
    id: string; email: string; displayName: string; isPremium: boolean;
    isOwner?: boolean; xp?: number; level?: number; runCoins?: number;
    streakDays?: number; lastRunAt?: string | null; premiumUntil?: string | null;
  }>('/users/me'),
  refresh: (refreshToken: string) =>
    request<{ accessToken: string; refreshToken: string }>(
      '/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }), auth: false },
    ),
  checkout: (plan: 'MONTHLY' | 'YEARLY') =>
    request<{ initPoint: string }>('/subscriptions/checkout', { method: 'POST', body: JSON.stringify({ plan }) }),
  listRuns: () => request<any[]>('/runs'),
  stravaStatus: () => request<{ connected: boolean; athleteId?: string | null; scope?: string | null; tokenValid?: boolean }>('/strava/status'),
  stravaAuthorizeUrl: () => request<{ url: string }>('/strava/authorize-url'),
  stravaImport: (sinceDays = 90) => request<{ imported: number; skipped: number }>(`/strava/import?sinceDays=${sinceDays}`, { method: 'POST' }),
  stravaDisconnect: () => request<void>('/strava/disconnect', { method: 'POST' }),
};

export const tokens = {
  save: (at: string, rt: string) => {
    localStorage.setItem('rq.at', at);
    localStorage.setItem('rq.rt', rt);
  },
  clear: () => {
    localStorage.removeItem('rq.at');
    localStorage.removeItem('rq.rt');
  },
  hasSession: () => typeof window !== 'undefined' && !!localStorage.getItem('rq.at'),
};
