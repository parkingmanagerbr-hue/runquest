import { WorkoutsController } from './workouts.module';

/**
 * Regressão da brecha de autorização em POST /workouts/session/start: o handler
 * gravava workoutId/runId do body sem checar posse. Como WorkoutSession.runId é
 * @unique, um usuário podia referenciar a corrida de outro, ocupar o slot e
 * derrubar (P2002) a sessão legítima do dono — além de apontar p/ treino privado.
 */
function makeFakePrisma(opts: {
  ownWorkout?: boolean;
  ownRun?: boolean;
}) {
  const created: unknown[] = [];
  const fake: any = {
    workout: {
      findFirst: async ({ where }: any) =>
        opts.ownWorkout && where.userId === 'me' ? { id: where.id } : null,
    },
    run: {
      findFirst: async ({ where }: any) =>
        opts.ownRun && where.userId === 'me' ? { id: where.id } : null,
    },
    workoutSession: {
      create: async ({ data }: any) => { created.push(data); return data; },
    },
  };
  return { fake, created };
}

const me = { id: 'me' } as any;

describe('WorkoutsController.startSession — posse', () => {
  it('treino de outro usuário → WORKOUT_NOT_FOUND, nada é criado', async () => {
    const { fake, created } = makeFakePrisma({ ownWorkout: false });
    const ctrl = new WorkoutsController(fake);
    const r: any = await ctrl.startSession(me, { workoutId: 'alheio', runId: undefined } as any);
    expect(r.error).toBe('WORKOUT_NOT_FOUND');
    expect(created).toHaveLength(0);
  });

  it('corrida de outro usuário → RUN_NOT_FOUND (não ocupa o slot unique alheio)', async () => {
    const { fake, created } = makeFakePrisma({ ownWorkout: true, ownRun: false });
    const ctrl = new WorkoutsController(fake);
    const r: any = await ctrl.startSession(me, { workoutId: 'meu', runId: 'alheio' } as any);
    expect(r.error).toBe('RUN_NOT_FOUND');
    expect(created).toHaveLength(0);
  });

  it('treino e corrida próprios → cria a sessão', async () => {
    const { fake, created } = makeFakePrisma({ ownWorkout: true, ownRun: true });
    const ctrl = new WorkoutsController(fake);
    const r: any = await ctrl.startSession(me, { workoutId: 'meu', runId: 'minha' } as any);
    expect(r.error).toBeUndefined();
    expect(created).toHaveLength(1);
    expect((created[0] as any).userId).toBe('me');
  });

  it('sem runId → só valida o treino e cria', async () => {
    const { fake, created } = makeFakePrisma({ ownWorkout: true });
    const ctrl = new WorkoutsController(fake);
    const r: any = await ctrl.startSession(me, { workoutId: 'meu' } as any);
    expect(r.error).toBeUndefined();
    expect(created).toHaveLength(1);
  });
});
