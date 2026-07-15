import { MissionsController } from './missions.module';

/**
 * Prova da correção do BUG-5 (resgate atômico). Sem live-DB: um Prisma falso
 * STATEFUL modela a garantia de linha do banco — o `updateMany` com
 * `claimed: false` no WHERE só vira o registro UMA vez; o segundo request
 * (que passou pela leitura obsoleta) recebe count 0 e NÃO credita.
 *
 * Se alguém reverter para o `update` incondicional antigo, o crédito duplicaria
 * e este teste quebra.
 */
function makeFakePrisma(reward: { xpReward: number; coinReward: number }) {
  const state = { claimed: false };
  const credits = { xp: 0, coins: 0, updates: 0 };

  const fake: any = {
    missionProgress: {
      // Leitura OBSOLETA: ambos os requests concorrentes viram claimed:false.
      findUnique: async () => ({ completed: true, claimed: false, mission: reward }),
      // Guarda atômica: só vira se ainda estiver claimed:false.
      updateMany: async ({ where }: any) => {
        if (where.claimed === false && state.claimed === false) {
          state.claimed = true;
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    user: {
      update: async ({ data }: any) => {
        credits.xp += data.xp.increment;
        credits.coins += data.runCoins.increment;
        credits.updates += 1;
        return {};
      },
    },
    // Forma callback: tx é o próprio fake (mesma "conexão").
    $transaction: async (fn: any) => fn(fake),
  };
  return { fake, credits, state };
}

describe('MissionsController.claim — atomicidade (BUG-5)', () => {
  const user = { id: 'u1' } as any;
  const reward = { xpReward: 100, coinReward: 50 };

  it('dois resgates concorrentes creditam UMA única vez', async () => {
    const { fake, credits } = makeFakePrisma(reward);
    const ctrl = new MissionsController(fake, null as any);

    const [r1, r2] = await Promise.all([
      ctrl.claim(user, 'm1'),
      ctrl.claim(user, 'm1'),
    ]);

    // Exatamente um vencedor; o outro recebe ALREADY_CLAIMED.
    const oks = [r1, r2].filter((r: any) => r.ok);
    const dupes = [r1, r2].filter((r: any) => r.error === 'ALREADY_CLAIMED');
    expect(oks).toHaveLength(1);
    expect(dupes).toHaveLength(1);

    // Crédito aplicado UMA vez só — nada de XP/moedas em dobro.
    expect(credits.updates).toBe(1);
    expect(credits.xp).toBe(100);
    expect(credits.coins).toBe(50);
  });

  it('resgate válido credita a recompensa', async () => {
    const { fake, credits } = makeFakePrisma(reward);
    const ctrl = new MissionsController(fake, null as any);
    const r: any = await ctrl.claim(user, 'm1');
    expect(r.ok).toBe(true);
    expect(r.xp).toBe(100);
    expect(credits.xp).toBe(100);
  });

  it('missão não concluída não credita', async () => {
    const { fake, credits } = makeFakePrisma(reward);
    fake.missionProgress.findUnique = async () => ({ completed: false, claimed: false, mission: reward });
    const ctrl = new MissionsController(fake, null as any);
    const r: any = await ctrl.claim(user, 'm1');
    expect(r.error).toBe('NOT_COMPLETED');
    expect(credits.updates).toBe(0);
  });

  it('missão inexistente retorna NOT_FOUND', async () => {
    const { fake } = makeFakePrisma(reward);
    fake.missionProgress.findUnique = async () => null;
    const ctrl = new MissionsController(fake, null as any);
    const r: any = await ctrl.claim(user, 'm1');
    expect(r.error).toBe('NOT_FOUND');
  });
});
