import { EnsureValidStravaTokenService } from './ensure-valid-token.service';

/**
 * Refresh de token do Strava — caminho por onde passa TODO import/webhook.
 * Repo + gateway falsos. Regra: refresha só quando faltam < 5 min de vida.
 */
function setup(token: any) {
  const saved: any[] = [];
  const refreshCalls: string[] = [];
  const repo: any = {
    findByUserId: async () => token,
    save: async (t: any) => { saved.push(t); },
  };
  const gw: any = {
    refresh: async (rt: string) => {
      refreshCalls.push(rt);
      return { accessToken: 'novo-at', refreshToken: 'novo-rt', expiresAt: new Date(Date.now() + 6 * 3600_000) };
    },
  };
  return { svc: new EnsureValidStravaTokenService(repo, gw), saved, refreshCalls };
}

const baseToken = (expiresAt: Date) => ({
  userId: 'u1', accessToken: 'at', refreshToken: 'rt', expiresAt, athleteId: 1n,
});

describe('EnsureValidStravaTokenService.get', () => {
  it('token com folga (> 5 min) → devolve como está, sem refresh', async () => {
    const { svc, saved, refreshCalls } = setup(baseToken(new Date(Date.now() + 3600_000)));
    const t = await svc.get('u1');
    expect(t.accessToken).toBe('at');
    expect(refreshCalls).toHaveLength(0);
    expect(saved).toHaveLength(0);
  });

  it('token expirando (< 5 min) → refresha, salva e devolve o novo', async () => {
    const { svc, saved, refreshCalls } = setup(baseToken(new Date(Date.now() + 60_000)));
    const t = await svc.get('u1');
    expect(refreshCalls).toEqual(['rt']);
    expect(t.accessToken).toBe('novo-at');
    expect(t.refreshToken).toBe('novo-rt');
    expect(saved).toHaveLength(1);
    expect(saved[0].accessToken).toBe('novo-at');
  });

  it('token já expirado → refresha', async () => {
    const { svc, refreshCalls } = setup(baseToken(new Date(Date.now() - 3600_000)));
    await svc.get('u1');
    expect(refreshCalls).toEqual(['rt']);
  });

  it('usuário sem token → lança "Strava not connected"', async () => {
    const { svc } = setup(null);
    await expect(svc.get('u1')).rejects.toThrow(/not connected/i);
  });
});
