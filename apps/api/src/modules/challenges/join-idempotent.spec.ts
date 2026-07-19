import { Prisma } from '@prisma/client';
import { ChallengesController } from './challenges.module';

/**
 * Regressão do join idempotente: duplo-clique em "Participar" fazia os dois
 * requests acharem `existing` null e ambos criarem → P2002 (@@unique) → 500 no
 * segundo. Agora o 2º trata como "já participa".
 */
const P2002 = new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: '5.22.0' });

function makeController(opts: { existing?: boolean; createThrowsP2002?: boolean }) {
  const now = Date.now();
  const prisma: any = {
    challenge: { findUnique: async () => ({ id: 'c1', active: true, endsAt: new Date(now + 86400000) }) },
    challengeParticipant: {
      findUnique: async () => (opts.existing ? { userId: 'u1', challengeId: 'c1' } : null),
      create: async () => { if (opts.createThrowsP2002) throw P2002; return {}; },
    },
  };
  return new ChallengesController(prisma);
}

const user = { id: 'u1' } as any;

describe('ChallengesController.join — idempotência', () => {
  it('primeira participação → ok', async () => {
    const r: any = await makeController({}).join(user, 'c1');
    expect(r.ok).toBe(true);
    expect(r.alreadyJoined).toBeUndefined();
  });

  it('já participa (leitura) → ok + alreadyJoined', async () => {
    const r: any = await makeController({ existing: true }).join(user, 'c1');
    expect(r).toEqual({ ok: true, alreadyJoined: true });
  });

  it('corrida no create (P2002) → tratado como já participa, sem 500', async () => {
    const r: any = await makeController({ createThrowsP2002: true }).join(user, 'c1');
    expect(r).toEqual({ ok: true, alreadyJoined: true });
  });
});
