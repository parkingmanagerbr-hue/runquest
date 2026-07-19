import { RefreshUseCase } from './refresh.usecase';
import { InvalidCredentialsError } from '../../../shared/errors/domain-error';

/**
 * Rotação de refresh token com detecção de reuso (replay). Segurança crítica:
 * um token válido deve rotacionar (revoga o antigo, emite novo); um token já
 * revogado/expirado/desconhecido deve REVOGAR TODA A FAMÍLIA do usuário (padrão
 * de mitigação de roubo de refresh token).
 */
function setup(opts: {
  stored?: { jti: string; revokedAt?: Date | null; expiresAt: Date } | null;
  userExists?: boolean;
  verifyThrows?: boolean;
} = {}) {
  const calls = { revoked: [] as string[], revokedAllFor: [] as string[], created: [] as any[] };
  const refresh: any = {
    findByJti: async () => opts.stored ?? null,
    revoke: async (jti: string) => { calls.revoked.push(jti); },
    revokeAllForUser: async (uid: string) => { calls.revokedAllFor.push(uid); },
    create: async (r: any) => { calls.created.push(r); },
  };
  const users: any = {
    findById: async () => (opts.userExists === false ? null : { id: 'u1', email: 'a@x.com', isPremium: false }),
  };
  const tokens: any = {
    verifyRefresh: async () => {
      if (opts.verifyThrows) throw new Error('bad jwt');
      return { sub: 'u1', jti: 'jti-old' };
    },
    issue: async () => ({
      accessToken: 'new-at', refreshToken: 'new-rt', refreshJti: 'jti-new',
      refreshExpiresAt: new Date(Date.now() + 7 * 86400000),
    }),
  };
  return { uc: new RefreshUseCase(users, refresh, tokens), calls };
}

const validStored = () => ({ jti: 'jti-old', revokedAt: null, expiresAt: new Date(Date.now() + 86400000) });

describe('RefreshUseCase — rotação + detecção de replay', () => {
  it('token válido → rotaciona (revoga o antigo, cria o novo)', async () => {
    const { uc, calls } = setup({ stored: validStored() });
    const t = await uc.execute('rt');
    expect(t.refreshJti).toBe('jti-new');
    expect(calls.revoked).toEqual(['jti-old']); // antigo invalidado
    expect(calls.created).toHaveLength(1);
    expect(calls.revokedAllFor).toHaveLength(0); // não é replay
  });

  it('JWT inválido → InvalidCredentials, sem tocar no repo', async () => {
    const { uc, calls } = setup({ verifyThrows: true });
    await expect(uc.execute('lixo')).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(calls.revokedAllFor).toHaveLength(0);
  });

  it('token REUSADO (já revogado) → revoga TODA a família do usuário (replay)', async () => {
    const { uc, calls } = setup({ stored: { jti: 'jti-old', revokedAt: new Date(), expiresAt: new Date(Date.now() + 86400000) } });
    await expect(uc.execute('rt')).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(calls.revokedAllFor).toEqual(['u1']); // mitigação de roubo
  });

  it('token desconhecido (não está no store) → revoga a família', async () => {
    const { uc, calls } = setup({ stored: null });
    await expect(uc.execute('rt')).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(calls.revokedAllFor).toEqual(['u1']);
  });

  it('token expirado → revoga a família', async () => {
    const { uc, calls } = setup({ stored: { jti: 'jti-old', revokedAt: null, expiresAt: new Date(Date.now() - 1000) } });
    await expect(uc.execute('rt')).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(calls.revokedAllFor).toEqual(['u1']);
  });

  it('usuário sumiu (deletado) → InvalidCredentials, não emite token', async () => {
    const { uc, calls } = setup({ stored: validStored(), userExists: false });
    await expect(uc.execute('rt')).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(calls.created).toHaveLength(0);
  });
});
