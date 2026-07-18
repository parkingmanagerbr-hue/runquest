import { TerritoryService } from './territories.module';

/**
 * Regressão da atomicidade de território. Antes: findUnique → create/update.
 * Dois processos na mesma célula (POST /runs + webhook Strava da mesma corrida)
 * achavam ambos `null` e o 2º `create` lançava P2002 — 500 no POST /runs depois
 * de já ter creditado XP. E a captura podia ser contada em dobro.
 *
 * Prisma falso STATEFUL modela o banco: `upsert` cria-ou-incrementa de forma
 * atômica; a captura só conta quando o `updateMany` guardado vira capturedAt.
 */
function makeFakePrisma() {
  const rows = new Map<string, { visits: number; capturedAt: Date | null }>();
  const missionCalls: number[] = [];

  const fake: any = {
    territory: {
      upsert: async ({ where, create, update }: any) => {
        const key = where.userId_h3Index.h3Index;
        const cur = rows.get(key);
        if (!cur) {
          rows.set(key, { visits: create.visits, capturedAt: create.capturedAt });
        } else {
          cur.visits += update.visits.increment;
        }
        const r = rows.get(key)!;
        return { visits: r.visits, capturedAt: r.capturedAt };
      },
      updateMany: async ({ where, data }: any) => {
        const r = rows.get(where.h3Index);
        // Guarda: só vira se ainda não capturado e no limiar.
        if (r && r.capturedAt === null && r.visits >= where.visits.gte) {
          r.capturedAt = data.capturedAt;
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
  };
  const missions: any = { incrementTerritoryCapture: async (_u: string, n: number) => { missionCalls.push(n); } };
  return { fake, missions, rows, missionCalls };
}

// Três pontos na MESMA célula (~poucos metros em SP) → 1 célula por chamada.
const sameCell: number[][] = [[-46.6300, -23.5500], [-46.63002, -23.55002]];

describe('TerritoryService.applyRun — captura atômica', () => {
  it('captura na 3ª visita e conta UMA vez só', async () => {
    const { fake, missions, missionCalls } = makeFakePrisma();
    const svc = new TerritoryService(fake, missions);

    const r1 = await svc.applyRun('u1', sameCell); // visita 1
    const r2 = await svc.applyRun('u1', sameCell); // visita 2
    const r3 = await svc.applyRun('u1', sameCell); // visita 3 → captura
    const r4 = await svc.applyRun('u1', sameCell); // visita 4 → nada

    expect(r1.newCaptures).toBe(0);
    expect(r2.newCaptures).toBe(0);
    expect(r3.newCaptures).toBe(1);
    expect(r4.newCaptures).toBe(0); // não recaptura
    expect(missionCalls).toEqual([1]); // missão incrementada exatamente 1×
  });

  it('trajeto vazio/invalido → sem visita, sem captura', async () => {
    const { fake, missions } = makeFakePrisma();
    const svc = new TerritoryService(fake, missions);
    expect(await svc.applyRun('u1', [])).toEqual({ visited: 0, newCaptures: 0 });
    expect(await svc.applyRun('u1', [[999, 999]])).toEqual({ visited: 0, newCaptures: 0 });
  });

  it('visited reflete o nº de células distintas do trajeto', async () => {
    const { fake, missions } = makeFakePrisma();
    const svc = new TerritoryService(fake, missions);
    const r = await svc.applyRun('u1', [[-46.63, -23.55], [-46.65, -23.57]]);
    expect(r.visited).toBe(2);
  });
});
