import { ChallengeProgressService } from './challenges.module';

/**
 * Cobertura do progresso de DESAFIOS após uma corrida (o módulo não tinha spec).
 * Prisma falso em memória, focando as regras: só participações ativas na janela
 * são tocadas, o incremento por tipo, a conclusão (>=) e o skip de tipo
 * desconhecido (não escreve nada).
 */
function makeFakePrisma(parts: any[]) {
  const updates: any[] = [];
  const fake: any = {
    challengeParticipant: {
      findMany: async () => parts,
      update: async (args: any) => { updates.push(args); return {}; },
    },
  };
  return { fake, updates };
}

const part = (over: any = {}) => ({
  userId: 'u1',
  challengeId: over.challengeId ?? 'c1',
  progress: over.progress ?? 0,
  completed: over.completed ?? false,
  completedAt: over.completedAt ?? null,
  challenge: { goalKind: over.goalKind ?? 'distance_km', goalValue: over.goalValue ?? 10 },
});

const run = { distanceMeters: 5000, durationSec: 1800 }; // 5 km, 30 min

describe('ChallengeProgressService.applyRun', () => {
  it('distance_km soma os km ao progresso', async () => {
    const { fake, updates } = makeFakePrisma([part({ progress: 3, goalValue: 20 })]);
    await new ChallengeProgressService(fake).applyRun('u1', run);
    expect(updates).toHaveLength(1);
    expect(updates[0].data.progress).toBe(8); // 3 + 5
    expect(updates[0].data.completed).toBe(false);
  });

  it('conclui e carimba completedAt quando atinge o alvo', async () => {
    const { fake, updates } = makeFakePrisma([part({ progress: 6, goalValue: 10 })]);
    await new ChallengeProgressService(fake).applyRun('u1', run); // 6 + 5 = 11 >= 10
    expect(updates[0].data.completed).toBe(true);
    expect(updates[0].data.completedAt).toBeInstanceOf(Date);
  });

  it('runs_count soma 1 por corrida', async () => {
    const { fake, updates } = makeFakePrisma([part({ goalKind: 'runs_count', progress: 2, goalValue: 5 })]);
    await new ChallengeProgressService(fake).applyRun('u1', run);
    expect(updates[0].data.progress).toBe(3);
  });

  it('tipo de objetivo desconhecido é PULADO (não escreve nada)', async () => {
    const { fake, updates } = makeFakePrisma([part({ goalKind: 'calories' })]);
    await new ChallengeProgressService(fake).applyRun('u1', run);
    expect(updates).toHaveLength(0);
  });

  it('sem participações ativas → nenhum update', async () => {
    const { fake, updates } = makeFakePrisma([]);
    await new ChallengeProgressService(fake).applyRun('u1', run);
    expect(updates).toHaveLength(0);
  });
});
