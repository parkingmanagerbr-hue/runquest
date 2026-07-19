import { PlansController } from './plans.module';

/**
 * GET /plans/today deve usar o dia LOCAL do usuário (enviado pelo cliente), não
 * o UTC do servidor. Antes, perto da meia-noite, quem está a oeste de Greenwich
 * via o treino de amanhã (ou nada), porque os planos adaptativos gravam datas
 * locais e o servidor comparava com a data UTC.
 */
function makeController(scheduled: any[]) {
  const prisma: any = {
    trainingPlan: {
      findFirst: async () => ({ id: 'p1', scheduledWorkouts: scheduled }),
    },
    workout: { findUnique: async () => null },
  };
  return new PlansController(prisma, {} as any);
}

const user = { id: 'u1' } as any;

describe('PlansController.today — dia local do cliente', () => {
  const schedule = [
    { date: '2026-07-15', label: 'Intervalado', completed: false },
    { date: '2026-07-16', label: 'Longo', completed: false },
  ];

  it('usa a data enviada pelo cliente (dia local)', async () => {
    const ctrl = makeController(schedule);
    const r: any = await ctrl.today(user, '2026-07-15');
    expect(r?.label).toBe('Intervalado');
  });

  it('data diferente pega o treino do outro dia', async () => {
    const ctrl = makeController(schedule);
    const r: any = await ctrl.today(user, '2026-07-16');
    expect(r?.label).toBe('Longo');
  });

  it('sem treino no dia → null', async () => {
    const ctrl = makeController(schedule);
    expect(await ctrl.today(user, '2026-07-20')).toBeNull();
  });

  it('data inválida cai no UTC do servidor (não confia em input malformado)', async () => {
    const ctrl = makeController(schedule);
    // "abc" não casa YYYY-MM-DD → usa hoje UTC, que não está no schedule fixo → null.
    expect(await ctrl.today(user, 'abc')).toBeNull();
  });

  it('treino já concluído no dia não é retornado', async () => {
    const ctrl = makeController([{ date: '2026-07-15', label: 'Feito', completed: true }]);
    expect(await ctrl.today(user, '2026-07-15')).toBeNull();
  });
});
