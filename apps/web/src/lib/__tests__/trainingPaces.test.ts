import { describe, it, expect } from 'vitest';
import { riegelPredict, estimatePaces, pacesFromReference, type RunLite } from '../trainingPaces';

const now = Date.parse('2026-07-04T12:00:00Z');
const iso = (daysAgo: number) => new Date(now - daysAgo * 86400000).toISOString();

describe('riegelPredict', () => {
  it('mesma distância = mesmo tempo', () => {
    expect(riegelPredict(5000, 1500, 5000)).toBeCloseTo(1500, 0);
  });
  it('distância maior = tempo maior', () => {
    expect(riegelPredict(5000, 1500, 10000)).toBeGreaterThan(3000);
  });
  it('entrada zero não quebra', () => {
    expect(riegelPredict(0, 0, 5000)).toBe(0);
  });
});

describe('estimatePaces', () => {
  const runs: RunLite[] = [
    { distanceMeters: 5000, durationSec: 1500, startedAt: iso(3) },
    { distanceMeters: 10000, durationSec: 3200, startedAt: iso(9) },
    { distanceMeters: 1200, durationSec: 400, startedAt: iso(20) }, // curta demais p/ ref
  ];

  it('deriva paces das corridas reais', () => {
    const p = estimatePaces(runs, now);
    expect(p.source).toBe('runs');
    expect(p.ref5kSec).toBeGreaterThan(600);
    expect(Number.isFinite(p.ref5kSec)).toBe(true);
  });

  it('ordem das zonas: intervalado < fácil < recuperação', () => {
    const { paces } = estimatePaces(runs, now);
    expect(paces.interval).toBeLessThan(paces.easy);
    expect(paces.easy).toBeLessThan(paces.recovery);
    expect(paces.repetition).toBeLessThan(paces.interval);
  });

  it('todos os paces finitos e >= 2:00/km', () => {
    const { paces } = estimatePaces(runs, now);
    for (const v of Object.values(paces)) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(120);
    }
  });

  it('sem corridas → source none, paces ainda finitos', () => {
    const p = estimatePaces([], now);
    expect(p.source).toBe('none');
    expect(Object.values(p.paces).every(Number.isFinite)).toBe(true);
  });

  it('ignora corridas curtas (<1,5 km) na estimativa', () => {
    const only = estimatePaces([{ distanceMeters: 800, durationSec: 200, startedAt: iso(1) }], now);
    expect(only.source).toBe('none');
  });
});

describe('pacesFromReference', () => {
  it('27:30 no 5K → source manual, ref finito', () => {
    const p = pacesFromReference(5000, 27 * 60 + 30);
    expect(p.source).toBe('manual');
    expect(p.ref5kSec).toBeGreaterThan(1600);
  });
});
