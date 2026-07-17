import { describe, it, expect } from 'vitest';
import { estimatePaces, pacesFromReference, type RunLite } from '../trainingPaces';
import {
  assessLoad, baseWeeklyKm, buildWeek, buildSchedule, sessionToWorkoutBody,
  acwrBand, type AcwrBand, type LoadSummary,
} from '../adaptivePlan';

const now = Date.parse('2026-07-04T12:00:00Z');
const iso = (d: number) => new Date(now - d * 86400000).toISOString();
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

const runs: RunLite[] = [
  { distanceMeters: 5000, durationSec: 1500, startedAt: iso(3) },
  { distanceMeters: 10000, durationSec: 3200, startedAt: iso(9) },
  { distanceMeters: 8000, durationSec: 2600, startedAt: iso(15) },
];
const paces = estimatePaces(runs, now);
const load = assessLoad(runs, now);
const base = baseWeeklyKm(load, '10k');

describe('assessLoad (ACWR)', () => {
  it('calcula agudo/crônico/acwr finitos', () => {
    expect(Number.isFinite(load.acwr)).toBe(true);
    expect(['low', 'ok', 'high', 'none']).toContain(load.status);
  });
  it('carga alta recente → status high', () => {
    const hi = assessLoad([
      { distanceMeters: 40000, durationSec: 12000, startedAt: iso(1) },
      { distanceMeters: 3000, durationSec: 1000, startedAt: iso(20) },
    ], now);
    expect(hi.acwr).toBeGreaterThan(1.3);
    expect(hi.status).toBe('high');
  });
  it('sem histórico → status none', () => {
    expect(assessLoad([], now).status).toBe('none');
  });
});

describe('buildWeek', () => {
  it('gera semana com sessões e segmentos válidos', () => {
    const w = buildWeek(paces, load, { goal: '10k', daysPerWeek: 4, weekIndex: 0, base });
    expect(w.sessions.length).toBeGreaterThan(0);
    expect(w.targetKm).toBeGreaterThan(0);
    for (const s of w.sessions) {
      expect(s.segments.length).toBeGreaterThan(0);
      expect(s.segments.every((seg) => Number.isFinite(seg.repeats))).toBe(true);
      expect(Number.isFinite(s.estDistanceM)).toBe(true);
      expect(Number.isFinite(s.estDurationSec)).toBe(true);
    }
  });
  it('semana 4 (idx3) é deload', () => {
    expect(buildWeek(paces, load, { goal: '10k', daysPerWeek: 4, weekIndex: 3, base }).deload).toBe(true);
  });
  it('progressão ~8%/semana quando carga permite', () => {
    const w0 = buildWeek(paces, load, { goal: '10k', daysPerWeek: 4, weekIndex: 0, base });
    const w1 = buildWeek(paces, load, { goal: '10k', daysPerWeek: 4, weekIndex: 1, base });
    expect(w1.targetKm).toBeGreaterThan(w0.targetKm);
  });
  it('ACWR alto trava a progressão', () => {
    const hi = assessLoad([
      { distanceMeters: 40000, durationSec: 12000, startedAt: iso(1) },
      { distanceMeters: 3000, durationSec: 1000, startedAt: iso(20) },
    ], now);
    const w = buildWeek(paces, hi, { goal: 'half', daysPerWeek: 5, weekIndex: 2, base: baseWeeklyKm(hi, 'half') });
    expect(w.acwrGated).toBe(true);
    expect(Number.isFinite(w.targetKm)).toBe(true);
  });

  it('sessionToWorkoutBody produz corpo válido do POST /workouts', () => {
    const w = buildWeek(paces, load, { goal: '10k', daysPerWeek: 4, weekIndex: 0, base });
    const body = sessionToWorkoutBody(w.sessions[0]);
    expect(body.name).toBeTruthy();
    expect(Array.isArray(body.segments)).toBe(true);
    expect(body.isTemplate).toBe(false);
  });
});

describe('buildSchedule', () => {
  const start = new Date('2026-07-06T00:00:00'); // segunda
  for (const weeks of [4, 8, 12]) {
    it(`weeks=${weeks}: datas válidas, na janela, dias distintos por semana`, () => {
      const sched = buildSchedule(paces, load, { goal: '10k', daysPerWeek: 4, base, weeks, startDate: start });
      expect(sched.length).toBeGreaterThan(0);
      expect(sched.every((e) => isDate(e.date))).toBe(true);
      expect(sched.every((e) => (e.durationSec ?? 0) > 0 && Number.isFinite(e.durationSec))).toBe(true);
      expect(sched.every((e) => !!e.label && e.completed === false)).toBe(true);
      const first = Date.parse(sched[0].date);
      const last = Date.parse(sched[sched.length - 1].date);
      expect(first).toBeGreaterThanOrEqual(Date.parse('2026-07-06'));
      expect(last).toBeLessThan(Date.parse('2026-07-06') + weeks * 7 * 86400000);
      // sem colisão de data dentro da mesma semana
      for (let wi = 0; wi < weeks; wi++) {
        const wkStart = Date.parse('2026-07-06') + wi * 7 * 86400000;
        const dates = sched.filter((e) => {
          const t = Date.parse(e.date);
          return t >= wkStart && t < wkStart + 7 * 86400000;
        }).map((e) => e.date);
        expect(new Set(dates).size).toBe(dates.length);
      }
    });
  }

  it('funciona com referência manual e 6 dias/semana', () => {
    const pm = pacesFromReference(5000, 25 * 60);
    const l0 = assessLoad([], now);
    const sm = buildSchedule(pm, l0, { goal: 'marathon', daysPerWeek: 6, base: baseWeeklyKm(l0, 'marathon'), weeks: 8, startDate: start });
    expect(sm.every((e) => Number.isFinite(e.distanceM))).toBe(true);
  });
});

describe('acwrBand — faixa de risco de lesão', () => {
  const mk = (acwr: number, status: LoadSummary['status'] = 'ok'): LoadSummary => ({
    acute7Km: 0, chronicWeeklyKm: 10, acwr, status, runsLast7: 3,
  });

  it('histórico insuficiente (status none) → insufficient', () => {
    expect(acwrBand(mk(0, 'none'))).toBe('insufficient');
  });

  it('classifica cada faixa pelos limiares da literatura', () => {
    const cases: [number, AcwrBand][] = [
      [0.5, 'very_low'],
      [0.6, 'below'], [0.79, 'below'],
      // 0,8 é o PISO da sweet spot — o assessLoad também trata 0,8 como 'ok'.
      [0.8, 'balanced'], [1.0, 'balanced'], [1.3, 'balanced'],
      [1.31, 'high'], [1.5, 'high'],
      [1.51, 'overload'], [2.0, 'overload'],
    ];
    for (const [acwr, band] of cases) {
      expect(acwrBand(mk(acwr))).toBe(band);
    }
  });

  it('a sweet spot 0,8–1,3 é "balanced" (menor risco)', () => {
    expect(acwrBand(mk(1.0))).toBe('balanced');
  });
});

describe('assessLoad — limite exato do histórico mínimo (regressão)', () => {
  it('chronicWeekly === 0.5 não classifica um ACWR que nunca foi calculado', () => {
    // 1 corrida de 2000 m há 10 dias ⇒ last28 = 2 km ⇒ chronicWeekly = 0.5.
    // Antes: o guard `> 0.5` deixava acwr no sentinela 0, mas o status `< 0.5`
    // era falso ⇒ 'low' ⇒ acwrBand mostrava "muito pouco treino" (very_low).
    const l = assessLoad([{ distanceMeters: 2000, durationSec: 700, startedAt: iso(10) }], now);
    expect(l.chronicWeeklyKm).toBe(0.5);
    // O ACWR agora é REAL (0 = nada nos últimos 7 dias), e o status é coerente.
    expect(l.status).not.toBe('none'); // tem histórico (0.5 >= 0.5)
    expect(l.acwr).toBe(0); // acute 0 / crônico 0.5 — calculado, não sentinela
  });

  it('abaixo do mínimo → status none (e acwrBand insufficient)', () => {
    // 1999 m ⇒ chronicWeekly = 0.49975 < 0.5
    const l = assessLoad([{ distanceMeters: 1999, durationSec: 700, startedAt: iso(10) }], now);
    expect(l.status).toBe('none');
    expect(acwrBand(l)).toBe('insufficient');
  });
});

describe('buildSchedule — datas em fuso LOCAL (regressão)', () => {
  it('a primeira sessão cai na data local de início, não no dia anterior (UTC)', () => {
    // Meia-noite LOCAL de 06/07/2026 (segunda). Em qualquer fuso a leste de
    // Greenwich, toISOString() devolveria 05/07 e o plano inteiro deslizaria.
    const start = new Date(2026, 6, 6, 0, 0, 0);
    const sched = buildSchedule(paces, load, { goal: '10k', daysPerWeek: 4, base, weeks: 2, startDate: start });
    const first = sched.map((e) => e.date).sort()[0];
    expect(first >= '2026-07-06').toBe(true);
    // Toda data emitida é a chave LOCAL de um Date — nunca desloca de fuso.
    for (const e of sched) expect(/^\d{4}-\d{2}-\d{2}$/.test(e.date)).toBe(true);
  });
});
