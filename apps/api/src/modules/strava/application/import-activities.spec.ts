import { Prisma } from '@prisma/client';
import { ImportStravaActivitiesUseCase } from './import-activities.usecase';

/**
 * Import em lote do Strava. Regras: pula atividades já importadas
 * (stravaActivityId @unique) e NÃO estoura o import inteiro se um webhook criou
 * a mesma atividade entre o findUnique e o create (P2002 → conta como skip).
 */
const P2002 = new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: '5.22.0' });

function setup(opts: {
  activities: any[];
  existingIds?: Set<number>;
  raceIds?: Set<number>; // ids que dão P2002 no create (webhook correu junto)
}) {
  const created: number[] = [];
  const tokens: any = { get: async () => ({ accessToken: 'at' }) };
  const gw: any = { listActivities: async () => opts.activities };
  const prisma: any = {
    run: {
      findUnique: async ({ where }: any) =>
        opts.existingIds?.has(Number(where.stravaActivityId)) ? { id: 'x' } : null,
      create: async ({ data }: any) => {
        const id = Number(data.stravaActivityId);
        if (opts.raceIds?.has(id)) throw P2002;
        created.push(id);
        return {};
      },
    },
  };
  return { uc: new ImportStravaActivitiesUseCase(tokens, gw, prisma), created };
}

const act = (id: number) => ({
  id, startDate: new Date('2026-07-01T10:00:00Z'), elapsedTimeSec: 1800,
  distanceMeters: 5000, movingTimeSec: 1700, averagePaceSecPerKm: 340, polyline: 'abc',
});

describe('ImportStravaActivitiesUseCase.execute', () => {
  it('importa as novas e pula as já existentes', async () => {
    const { uc, created } = setup({
      activities: [act(1), act(2), act(3)],
      existingIds: new Set([2]),
    });
    const r = await uc.execute('u1');
    expect(r).toEqual({ imported: 2, skipped: 1 });
    expect(created.sort()).toEqual([1, 3]);
  });

  it('P2002 no create (webhook correu junto) → conta skip, não estoura', async () => {
    const { uc, created } = setup({
      activities: [act(1), act(2)],
      raceIds: new Set([1]), // atividade 1 criada por um webhook no meio do caminho
    });
    const r = await uc.execute('u1');
    expect(r).toEqual({ imported: 1, skipped: 1 });
    expect(created).toEqual([2]);
  });

  it('sem atividades → nada importado', async () => {
    const { uc } = setup({ activities: [] });
    expect(await uc.execute('u1')).toEqual({ imported: 0, skipped: 0 });
  });
});
