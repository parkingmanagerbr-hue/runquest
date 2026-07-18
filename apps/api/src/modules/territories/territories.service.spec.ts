/**
 * CAMINHADA VIRTUAL — prova que quem repete o percurso vira dono do local.
 *
 * Testa o TerritoryService REAL (a mesma lógica que roda quando uma corrida é
 * salva) com um Prisma fake em memória: simula uma pessoa caminhando a mesma
 * rua em dias diferentes e verifica a regra de captura (3 visitas → dono),
 * expiração renovada e células novas.
 */
import { TerritoryService } from './territories.module';

// ── Prisma fake em memória (só a superfície que o service usa) ───────────────
type Row = {
  id: string; userId: string; h3Index: string; visits: number;
  lastVisitAt: Date; expiresAt: Date; capturedAt: Date | null;
};

function makeFakePrisma() {
  const rows = new Map<string, Row>(); // key = userId|h3
  const key = (w: { userId: string; h3Index: string }) => `${w.userId}|${w.h3Index}`;
  return {
    rows,
    territory: {
      // Superfície nova do service: upsert (cria-ou-incrementa) + updateMany
      // (captura guardada). Semântica em memória idêntica ao banco.
      upsert: async ({ where, create, update }: any) => {
        const k = key(where.userId_h3Index);
        const cur = rows.get(k);
        if (!cur) {
          rows.set(k, { ...create });
        } else {
          cur.visits += update.visits.increment;
          cur.lastVisitAt = update.lastVisitAt;
          cur.expiresAt = update.expiresAt;
        }
        const r = rows.get(k)!;
        return { visits: r.visits, capturedAt: r.capturedAt };
      },
      updateMany: async ({ where, data }: any) => {
        const r = rows.get(key(where));
        if (r && r.capturedAt === null && r.visits >= where.visits.gte) {
          r.capturedAt = data.capturedAt;
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
  };
}

const fakeMissions = { incrementTerritoryCapture: jest.fn(async () => undefined) };

/** Gera uma "caminhada" GeoJSON [lng,lat] ao longo de uma rua (~600m). */
function walkStreet(latBase: number): number[][] {
  const pts: number[][] = [];
  for (let i = 0; i <= 30; i++) {
    // ~20m por passo em longitude (0.0002° ≈ 20m no equador)
    pts.push([-46.63 + i * 0.0002, latBase]);
  }
  return pts;
}

describe('Caminhada virtual → dono do local (TerritoryService.applyRun)', () => {
  let prisma: ReturnType<typeof makeFakePrisma>;
  let svc: TerritoryService;
  const USER = 'walker-1';

  beforeEach(() => {
    prisma = makeFakePrisma();
    svc = new TerritoryService(prisma as any, fakeMissions as any);
    fakeMissions.incrementTerritoryCapture.mockClear();
  });

  it('1ª caminhada: visita células mas NÃO captura ainda', async () => {
    const r = await svc.applyRun(USER, walkStreet(-23.55));
    expect(r.visited).toBeGreaterThan(0);
    expect(r.newCaptures).toBe(0);
    for (const row of prisma.rows.values()) {
      expect(row.visits).toBe(1);
      expect(row.capturedAt).toBeNull();
    }
  });

  it('3 caminhadas na MESMA rua: vira dono (captura na 3ª)', async () => {
    await svc.applyRun(USER, walkStreet(-23.55));
    const r2 = await svc.applyRun(USER, walkStreet(-23.55));
    expect(r2.newCaptures).toBe(0); // 2 visitas ainda não é dono
    const r3 = await svc.applyRun(USER, walkStreet(-23.55));
    expect(r3.newCaptures).toBeGreaterThan(0); // 3ª visita → CAPTUROU
    expect(r3.newCaptures).toBe(r3.visited); // toda a rua capturada de uma vez
    for (const row of prisma.rows.values()) {
      expect(row.visits).toBe(3);
      expect(row.capturedAt).not.toBeNull();
    }
    // gamificação notificada
    expect(fakeMissions.incrementTerritoryCapture).toHaveBeenCalledWith(USER, r3.newCaptures);
  });

  it('4ª caminhada: já é dono, não "recaptura" (newCaptures=0) e renova expiração', async () => {
    for (let i = 0; i < 3; i++) await svc.applyRun(USER, walkStreet(-23.55));
    const before = [...prisma.rows.values()][0].expiresAt.getTime();
    await new Promise((r) => setTimeout(r, 5));
    const r4 = await svc.applyRun(USER, walkStreet(-23.55));
    expect(r4.newCaptures).toBe(0);
    const after = [...prisma.rows.values()][0].expiresAt.getTime();
    expect(after).toBeGreaterThanOrEqual(before); // expiração renovada (21 dias a partir de agora)
  });

  it('rua DIFERENTE cria células novas independentes', async () => {
    await svc.applyRun(USER, walkStreet(-23.55));
    const cellsRua1 = prisma.rows.size;
    await svc.applyRun(USER, walkStreet(-23.58)); // ~3km ao sul, outra vizinhança
    expect(prisma.rows.size).toBeGreaterThan(cellsRua1);
    // rua 2 tem 1 visita; rua 1 continua com 1
    const visitCounts = [...prisma.rows.values()].map((r) => r.visits);
    expect(visitCounts.every((v) => v === 1)).toBe(true);
  });

  it('entrada vazia/inválida não quebra nem captura', async () => {
    expect(await svc.applyRun(USER, [])).toEqual({ visited: 0, newCaptures: 0 });
    const r = await svc.applyRun(USER, [[NaN, NaN], [999, 999]] as any);
    expect(r.newCaptures).toBe(0);
  });
});
