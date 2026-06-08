const API = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
  }
}

// Singleton refresh promise — prevents parallel refresh races
let _refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const rt = localStorage.getItem('rq.rt');
  if (!rt) return null;
  try {
    const res = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
      cache: 'no-store',
    });
    if (!res.ok) { localStorage.removeItem('rq.at'); localStorage.removeItem('rq.rt'); return null; }
    const d = await res.json();
    localStorage.setItem('rq.at', d.accessToken);
    localStorage.setItem('rq.rt', d.refreshToken);
    return d.accessToken as string;
  } catch { return null; }
}

async function request<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (init.auth !== false) {
    const at = typeof window !== 'undefined' ? localStorage.getItem('rq.at') : null;
    if (at) headers.set('Authorization', `Bearer ${at}`);
  }
  const res = await fetch(`${API}${path}`, { ...init, headers, cache: 'no-store' });

  // Auto-refresh access token on 401 (expired), then retry once
  if (res.status === 401 && init.auth !== false) {
    if (!_refreshing) _refreshing = doRefresh().finally(() => { _refreshing = null; });
    const newAt = await _refreshing;
    if (newAt) {
      const h2 = new Headers(init.headers);
      h2.set('Content-Type', 'application/json');
      h2.set('Authorization', `Bearer ${newAt}`);
      const res2 = await fetch(`${API}${path}`, { ...init, headers: h2, cache: 'no-store' });
      const txt2 = await res2.text();
      const body2 = txt2 ? JSON.parse(txt2) : null;
      if (!res2.ok) throw new ApiError(body2?.message ?? res2.statusText, res2.status, body2?.error);
      return body2 as T;
    }
    // Refresh failed — redirect to login
    if (typeof window !== 'undefined') window.location.href = '/auth/login';
    throw new ApiError('Session expired', 401);
  }

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
  checkout: (plan: 'MONTHLY' | 'YEARLY', currency?: string, locale?: string) =>
    request<{ initPoint: string }>('/subscriptions/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan, ...(currency ? { currency } : {}), ...(locale ? { locale } : {}) }),
    }),
  listRuns: () => request<any[]>('/runs'),
  stravaStatus: () => request<{ connected: boolean; athleteId?: string | null; scope?: string | null; tokenValid?: boolean }>('/strava/status'),
  stravaAuthorizeUrl: () => request<{ url: string }>('/strava/authorize-url'),
  stravaImport: (sinceDays = 90) => request<{ imported: number; skipped: number }>(`/strava/import?sinceDays=${sinceDays}`, { method: 'POST' }),
  stravaDisconnect: () => request<void>('/strava/disconnect', { method: 'POST' }),
  subscriptionMe: () =>
    request<{ status: string; plan?: 'MONTHLY' | 'YEARLY'; nextPaymentAt?: string | null; cancelledAt?: string | null }>('/subscriptions/me'),
  coachChat: (messages: { role: 'user' | 'assistant'; content: string }[]) =>
    request<{ reply: string }>('/plans/coach-chat', { method: 'POST', body: JSON.stringify({ messages }) }),
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
