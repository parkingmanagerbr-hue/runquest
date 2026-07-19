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

  it('descarta outlier de GPS (pace impossível) sem corromper o estimador', () => {
    const clean = estimatePaces([{ distanceMeters: 5000, durationSec: 1500, startedAt: iso(3) }], now);
    const withGlitch = estimatePaces([
      { distanceMeters: 5000, durationSec: 1500, startedAt: iso(3) },
      { distanceMeters: 5000, durationSec: 480, startedAt: iso(5) }, // 1:36/km = glitch
    ], now);
    // o glitch é descartado → estimativa idêntica à do dado limpo
    expect(withGlitch.ref5kSec).toBe(clean.ref5kSec);
  });
});

describe('pacesFromReference', () => {
  it('27:30 no 5K → source manual, ref finito', () => {
    const p = pacesFromReference(5000, 27 * 60 + 30);
    expect(p.source).toBe('manual');
    expect(p.ref5kSec).toBeGreaterThan(1600);
  });
});

describe('estimatePaces — penalização por idade (> 90 dias)', () => {
  const fresh: RunLite = { distanceMeters: 5000, durationSec: 1500, startedAt: iso(10) };
  const old: RunLite = { distanceMeters: 5000, durationSec: 1500, startedAt: iso(365) };

  it('a MESMA corrida antiga estima um 5K mais lento que a recente', () => {
    const pRecent = estimatePaces([fresh], now);
    const pOld = estimatePaces([old], now);
    expect(pRecent.source).toBe('runs');
    expect(pOld.source).toBe('runs');
    // Corrida de ~1 ano é penalizada → 5K equivalente maior (mais lento).
    expect(pOld.ref5kSec).toBeGreaterThan(pRecent.ref5kSec);
  });

  it('penalidade ~1%/mês além de 90 dias (365 dias ≈ +9%)', () => {
    const pOld = estimatePaces([old], now);
    // 1500s base; ageDays 365 → penalty 1 + (365-90)/3000 ≈ 1.0917
    expect(pOld.ref5kSec).toBeGreaterThan(1600);
    expect(pOld.ref5kSec).toBeLessThan(1660);
  });

  it('corrida recente (< 90 dias) não é penalizada — 5K ≈ tempo real', () => {
    // fresh = 10 dias atrás; sem penalidade, o 5K equivalente ≈ 1500s.
    const p = estimatePaces([fresh], now);
    expect(p.ref5kSec).toBeCloseTo(1500, -1);
  });
});

describe('pacesFromReference — entrada inválida', () => {
  it('referência inválida (tempo 0) → source none', () => {
    expect(pacesFromReference(5000, 0).source).toBe('none');
  });
  it('referência válida → source manual', () => {
    expect(pacesFromReference(5000, 1500).source).toBe('manual');
  });
});
