import { ConnectStravaUseCase } from './connect-strava.usecase';

/**
 * Proteção CSRF do OAuth do Strava. O `state` liga o callback ao usuário que
 * iniciou o fluxo; tem que ser aleatório, de USO ÚNICO e expirar. Sem isto, um
 * atacante conectaria a própria conta Strava à sessão da vítima (login CSRF).
 */
function setup() {
  const saved: any[] = [];
  const gw: any = {
    authorizeUrl: (state: string, cb: string) => `https://strava/oauth?state=${state}&cb=${encodeURIComponent(cb)}`,
    exchangeCode: async () => ({
      athleteId: 42, accessToken: 'at', refreshToken: 'rt',
      expiresAt: new Date(Date.now() + 3600_000), scope: 'read',
    }),
    deauthorize: async () => undefined,
  };
  const repo: any = {
    save: async (t: any) => { saved.push(t); },
    findByUserId: async () => null,
    deleteByUserId: async () => undefined,
  };
  const cfg: any = { get: () => undefined };
  return { uc: new ConnectStravaUseCase(gw, repo, cfg), saved };
}

const stateFromUrl = (url: string) => new URL(url).searchParams.get('state')!;

describe('ConnectStravaUseCase — CSRF state', () => {
  it('beginAuth gera states únicos e imprevisíveis', () => {
    const { uc } = setup();
    const s1 = stateFromUrl(uc.beginAuth('u1'));
    const s2 = stateFromUrl(uc.beginAuth('u1'));
    expect(s1).not.toBe(s2);
    expect(s1).toMatch(/^[0-9a-f]{48}$/); // 24 bytes hex
  });

  it('callback com state válido → liga ao usuário certo e salva o token', async () => {
    const { uc, saved } = setup();
    const state = stateFromUrl(uc.beginAuth('u1'));
    const r = await uc.handleCallback('code-xyz', state);
    expect(r.userId).toBe('u1');
    expect(saved).toHaveLength(1);
    expect(saved[0].userId).toBe('u1');
  });

  it('state é de USO ÚNICO — segundo callback com o mesmo state falha', async () => {
    const { uc } = setup();
    const state = stateFromUrl(uc.beginAuth('u1'));
    await uc.handleCallback('code-1', state);
    await expect(uc.handleCallback('code-2', state)).rejects.toThrow(/invalid or expired/i);
  });

  it('state desconhecido (forjado) → rejeita', async () => {
    const { uc } = setup();
    await expect(uc.handleCallback('code', 'forjado')).rejects.toThrow(/invalid or expired/i);
  });

  it('state expirado → rejeita', async () => {
    const { uc } = setup();
    const state = stateFromUrl(uc.beginAuth('u1'));
    // Empurra o relógio 11 min à frente (TTL é 10 min).
    const realNow = Date.now;
    Date.now = () => realNow() + 11 * 60_000;
    try {
      await expect(uc.handleCallback('code', state)).rejects.toThrow(/invalid or expired/i);
    } finally {
      Date.now = realNow;
    }
  });
});
