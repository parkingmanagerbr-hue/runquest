import { describe, it, expect } from 'vitest';
import { riegelPredict, estimatePaces, type RunLite } from '../trainingPaces';
import { ghostProgress } from '../ghostRace';
import { routeDistanceM, outAndBack, closeLoop, type LatLng } from '../routePlanner';
import { parseRscMeasurement } from '../useCadence';
import { routeToPath } from '../runCard';
import { computeFitnessTrend } from '../fitnessTrend';
import { assessLoad, baseWeeklyKm, buildWeek, type Goal } from '../adaptivePlan';

/**
 * PROPERTY-BASED TESTS — invariantes sobre entradas ALEATÓRIAS (não exemplos a
 * dedo). RNG semeado (mulberry32) → determinístico e reproduzível. Pega edge
 * cases que o teste por exemplo não alcança.
 */

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = mulberry32(1337);
const rnd = (lo: number, hi: number) => lo + R() * (hi - lo);
const rint = (lo: number, hi: number) => Math.floor(rnd(lo, hi + 1));
const N = 500;

describe('riegelPredict — invariantes', () => {
  it('monótona crescente na distância-alvo; sempre positiva; sem NaN', () => {
    for (let i = 0; i < N; i++) {
      const d1 = rnd(1000, 10000);
      const t1 = rnd(180, 6000);
      const a = rnd(400, 42000);
      const b = a + rnd(1, 5000);
      const pa = riegelPredict(d1, t1, a);
      const pb = riegelPredict(d1, t1, b);
      expect(Number.isFinite(pa) && pa > 0).toBe(true);
      expect(pb).toBeGreaterThan(pa); // distância maior ⇒ tempo maior
    }
  });
  it('mesma distância ⇒ mesmo tempo (ponto fixo)', () => {
    for (let i = 0; i < N; i++) {
      const d = rnd(1000, 20000);
      const t = rnd(180, 7200);
      expect(riegelPredict(d, t, d)).toBeCloseTo(t, 6);
    }
  });
});

describe('ghostProgress — invariantes', () => {
  it('gap consistente, ahead coerente, nunca NaN, para quaisquer entradas', () => {
    for (let i = 0; i < N; i++) {
      const g = ghostProgress({
        elapsedSec: rnd(-10, 7200),
        youMeters: rnd(-100, 42000),
        ghostPaceSecPerKm: R() < 0.1 ? 0 : rnd(150, 500),
        targetDistanceM: R() < 0.5 ? rnd(1000, 42000) : undefined,
      });
      expect(Number.isFinite(g.gapMeters)).toBe(true);
      expect(Number.isFinite(g.gapSec)).toBe(true);
      expect(g.youMeters).toBeGreaterThanOrEqual(0);
      expect(g.ghostMeters).toBeGreaterThanOrEqual(0);
      expect(g.ahead).toBe(g.gapMeters >= 0);
      // gap ≈ você − fantasma (± arredondamento independente)
      expect(Math.abs(g.gapMeters - (g.youMeters - g.ghostMeters))).toBeLessThanOrEqual(1);
      expect(g.progress).toBeGreaterThanOrEqual(0);
      expect(g.progress).toBeLessThanOrEqual(1);
    }
  });
});

describe('routePlanner — invariantes geométricas', () => {
  const randPath = (): LatLng[] => Array.from({ length: rint(0, 8) }, () => [rnd(-33, 5), rnd(-73, -34)] as LatLng);
  it('distância ≥ 0; reverter não muda; ida-e-volta ≈ 2×; fechar não encurta', () => {
    for (let i = 0; i < N; i++) {
      const p = randPath();
      const d = routeDistanceM(p);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(d)).toBe(true);
      expect(routeDistanceM([...p].reverse())).toBeCloseTo(d, 3); // simetria
      if (p.length >= 2) {
        expect(Math.abs(routeDistanceM(outAndBack(p)) - 2 * d)).toBeLessThanOrEqual(2);
      }
      if (p.length >= 3) {
        expect(routeDistanceM(closeLoop(p))).toBeGreaterThanOrEqual(d - 1e-6);
      }
    }
  });
});

describe('parseRscMeasurement — fuzz (nunca lança)', () => {
  it('qualquer buffer de bytes aleatórios: sem exceção, campos válidos', () => {
    for (let i = 0; i < N; i++) {
      const len = rint(0, 20);
      const bytes = Array.from({ length: len }, () => rint(0, 255));
      const dv = new DataView(new Uint8Array(bytes).buffer);
      const r = parseRscMeasurement(dv);
      // cadência: null ou dentro do range plausível
      expect(r.cadenceSpm === null || (r.cadenceSpm > 0 && r.cadenceSpm < 260)).toBe(true);
      expect(r.speedMs === null || Number.isFinite(r.speedMs)).toBe(true);
    }
  });
});

describe('runCard.routeToPath — invariantes de projeção', () => {
  it('todo ponto dentro do padding; sem NaN; para coords aleatórias', () => {
    const W = 1080, H = 760, PAD = 120;
    for (let i = 0; i < N; i++) {
      const coords = Array.from({ length: rint(0, 10) }, () => [rnd(-73, -34), rnd(-33, 5)]);
      const path = routeToPath(coords, W, H, PAD);
      expect(path).not.toMatch(/NaN/);
      for (const m of path.matchAll(/[ML]([-\d.]+),([-\d.]+)/g)) {
        const x = +m[1], y = +m[2];
        expect(x).toBeGreaterThanOrEqual(PAD - 1);
        expect(x).toBeLessThanOrEqual(W - PAD + 1);
        expect(y).toBeGreaterThanOrEqual(PAD - 1);
        expect(y).toBeLessThanOrEqual(H - PAD + 1);
      }
    }
  });
});

describe('computeFitnessTrend & adaptivePlan — robustez (nunca lança; saída válida)', () => {
  const now = Date.parse('2026-07-10T12:00:00Z');
  const goals: Goal[] = ['5k', '10k', 'half', 'marathon', 'fitness'];
  it('fitnessTrend: trend válido, r2∈[0,1], sem crash, para corridas aleatórias', () => {
    for (let i = 0; i < 200; i++) {
      const runs: RunLite[] = Array.from({ length: rint(0, 30) }, () => ({
        distanceMeters: rnd(0, 42000),
        durationSec: rnd(0, 14400),
        startedAt: new Date(now - rnd(0, 200) * 86400000).toISOString(),
      }));
      const t = computeFitnessTrend(runs, now, rint(4, 16));
      expect(['improving', 'flat', 'declining', 'insufficient']).toContain(t.trend);
      expect(t.r2).toBeGreaterThanOrEqual(0);
      expect(t.r2).toBeLessThanOrEqual(1);
      expect(Number.isFinite(t.totalKm)).toBe(true);
    }
  });
  it('adaptivePlan.buildWeek: targetKm finito>0 e segmentos válidos, para entradas aleatórias', () => {
    for (let i = 0; i < 200; i++) {
      const runs: RunLite[] = Array.from({ length: rint(0, 20) }, () => ({
        distanceMeters: rnd(1500, 20000),
        durationSec: rnd(400, 7200),
        startedAt: new Date(now - rnd(0, 60) * 86400000).toISOString(),
      }));
      const paces = estimatePaces(runs, now);
      const load = assessLoad(runs, now);
      const goal = goals[rint(0, goals.length - 1)];
      const base = baseWeeklyKm(load, goal);
      const w = buildWeek(paces, load, { goal, daysPerWeek: rint(2, 6), weekIndex: rint(0, 23), base });
      expect(Number.isFinite(w.targetKm) && w.targetKm > 0).toBe(true);
      expect(w.sessions.length).toBeGreaterThan(0);
      for (const s of w.sessions) {
        expect(s.segments.length).toBeGreaterThan(0);
        expect(Number.isFinite(s.estDurationSec) && s.estDurationSec > 0).toBe(true);
      }
    }
  });
});
