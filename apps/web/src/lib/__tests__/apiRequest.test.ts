// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { api } from '../api';

/**
 * Prova do C.1: o cliente `api` renova o access token em 401 e repete a chamada.
 * As telas que usavam `fetch` cru + token do localStorage NÃO tinham nada disso —
 * o usuário era deslogado assim que o token expirava.
 */

const ok = (body: unknown) => ({
  ok: true, status: 200, statusText: 'OK',
  text: async () => JSON.stringify(body),
  json: async () => body,
});
const unauthorized = () => ({
  ok: false, status: 401, statusText: 'Unauthorized',
  text: async () => JSON.stringify({ message: 'expired' }),
  json: async () => ({ message: 'expired' }),
});

const authHeaderOf = (call: unknown[]) => ((call[1] as RequestInit).headers as Headers).get('Authorization');

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('api.get — token e auto-refresh', () => {
  it('anexa o Bearer token do localStorage', async () => {
    localStorage.setItem('rq.at', 'tok-1');
    const f = vi.fn().mockResolvedValue(ok({ x: 1 }));
    vi.stubGlobal('fetch', f);

    await expect(api.get('/foo')).resolves.toEqual({ x: 1 });
    expect(authHeaderOf(f.mock.calls[0])).toBe('Bearer tok-1');
  });

  it('401 → renova o token, repete a chamada e persiste o novo token', async () => {
    localStorage.setItem('rq.at', 'velho');
    localStorage.setItem('rq.rt', 'refresh-1');
    const f = vi.fn()
      .mockResolvedValueOnce(unauthorized()) // 1ª tentativa expira
      .mockResolvedValueOnce(ok({ accessToken: 'novo', refreshToken: 'refresh-2' })) // refresh
      .mockResolvedValueOnce(ok({ dados: 'ok' })); // repetição
    vi.stubGlobal('fetch', f);

    await expect(api.get('/foo')).resolves.toEqual({ dados: 'ok' });

    expect(f).toHaveBeenCalledTimes(3);
    expect(String(f.mock.calls[1][0])).toContain('/auth/refresh');
    // A repetição usa o token NOVO — não o expirado.
    expect(authHeaderOf(f.mock.calls[2])).toBe('Bearer novo');
    // Tokens renovados ficam persistidos para as próximas chamadas.
    expect(localStorage.getItem('rq.at')).toBe('novo');
    expect(localStorage.getItem('rq.rt')).toBe('refresh-2');
  });

  it('401 em paralelo dispara UM único refresh (sem estouro de refresh)', async () => {
    localStorage.setItem('rq.at', 'velho');
    localStorage.setItem('rq.rt', 'refresh-1');
    const f = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('/auth/refresh')) {
        return ok({ accessToken: 'novo', refreshToken: 'refresh-2' });
      }
      // Primeira rodada expira; depois de renovar, passa.
      return localStorage.getItem('rq.at') === 'novo' ? ok({ dados: 'ok' }) : unauthorized();
    });
    vi.stubGlobal('fetch', f);

    await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')]);

    const refreshCalls = f.mock.calls.filter((c) => String(c[0]).includes('/auth/refresh'));
    expect(refreshCalls).toHaveLength(1); // singleton — não 3
  });
});

describe('api.post — corpo e método', () => {
  it('envia método POST com o corpo em JSON', async () => {
    localStorage.setItem('rq.at', 'tok');
    const f = vi.fn().mockResolvedValue(ok({ criado: true }));
    vi.stubGlobal('fetch', f);

    await api.post('/coisas', { nome: 'x' });

    const [, init] = f.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ nome: 'x' }));
  });

  it('POST sem corpo não envia body', async () => {
    localStorage.setItem('rq.at', 'tok');
    const f = vi.fn().mockResolvedValue(ok({}));
    vi.stubGlobal('fetch', f);

    await api.post('/acao');

    expect(f.mock.calls[0][1].body).toBeUndefined();
  });
});
