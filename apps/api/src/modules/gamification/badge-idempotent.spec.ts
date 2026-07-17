import { Prisma } from '@prisma/client';
import { BadgeUnlockService } from './gamification.module';

/**
 * Regressão da atomicidade do desbloqueio de badge: quando o POST /runs e o
 * webhook do Strava processam a mesma corrida quase juntos, ambos leem os badges
 * possuídos sem o novo badge e ambos tentam criar. Antes, o perdedor lançava
 * P2002 não tratado → 500 no POST /runs DEPOIS de já ter creditado XP/streak.
 * Agora o perdedor pula (sem creditar XP de novo, sem derrubar o request).
 */
const P2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
  code: 'P2002', clientVersion: '5.22.0',
});

function makeFakePrisma(opts: { createThrowsP2002?: boolean }) {
  const credited: number[] = [];
  const fake: any = {
    badge: {
      findMany: async () => [
        { id: 'b1', code: 'FIRST', title: 'Primeira', icon: '🏅',
          requirementKind: 'total_runs', requirementValue: 1, xpReward: 50, coinReward: 10 },
      ],
    },
    userBadge: {
      findMany: async () => [], // leitura obsoleta: ainda não possui
      create: async () => {
        if (opts.createThrowsP2002) throw P2002;
        return {};
      },
    },
    user: {
      update: async ({ data }: any) => { credited.push(data.xp.increment); return {}; },
    },
  };
  return { fake, credited };
}

describe('BadgeUnlockService.checkAndUnlock — idempotência sob concorrência', () => {
  const ctx = { totalRuns: 1 };

  it('desbloqueio normal credita o XP e retorna o badge', async () => {
    const { fake, credited } = makeFakePrisma({});
    const svc = new BadgeUnlockService(fake);
    const out = await svc.checkAndUnlock('u1', ctx);
    expect(out.map((b) => b.code)).toEqual(['FIRST']);
    expect(credited).toEqual([50]);
  });

  it('P2002 (outro processo já desbloqueou) → pula sem creditar nem lançar', async () => {
    const { fake, credited } = makeFakePrisma({ createThrowsP2002: true });
    const svc = new BadgeUnlockService(fake);
    const out = await svc.checkAndUnlock('u1', ctx);
    expect(out).toEqual([]); // não anuncia badge que não criou
    expect(credited).toEqual([]); // e NÃO credita XP em dobro
  });
});
