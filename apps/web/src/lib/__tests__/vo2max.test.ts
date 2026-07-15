import { describe, it, expect } from 'vitest';
import { estimateVo2max } from '../vo2max';

describe('estimateVo2max — Cooper a partir do melhor pace plausível', () => {
  it('sem amostras válidas → null', () => {
    expect(estimateVo2max([])).toBeNull();
    expect(estimateVo2max([{ distanceMeters: 500, avgPaceSecPerKm: 300 }])).toBeNull(); // curta demais
    expect(estimateVo2max([{ distanceMeters: 3000, avgPaceSecPerKm: 0 }])).toBeNull(); // sem pace
  });

  it('golden: 5:00/km (300 s/km) → 42.4', () => {
    // 60000/300 = 200 m/min → 2400 m em 12 min → (2400-504.9)/44.73 = 42.37
    expect(estimateVo2max([{ distanceMeters: 3000, avgPaceSecPerKm: 300 }])).toBe(42.4);
  });

  it('NÃO deixa um glitch de GPS (pace absurdo) inflar o VO2max', () => {
    const semGlitch = estimateVo2max([
      { distanceMeters: 3000, avgPaceSecPerKm: 300 },
      { distanceMeters: 5000, avgPaceSecPerKm: 280 },
    ]);
    const comGlitch = estimateVo2max([
      { distanceMeters: 3000, avgPaceSecPerKm: 300 },
      { distanceMeters: 5000, avgPaceSecPerKm: 280 },
      { distanceMeters: 3000, avgPaceSecPerKm: 90 }, // 1:30/km impossível — descartado
    ]);
    // O glitch é descartado: mesmo resultado com ou sem ele (usa o mais rápido PLAUSÍVEL).
    expect(comGlitch).toBe(semGlitch);
    expect(comGlitch).toBe(46.2);
  });

  it('pace lento demais (VO2 < 20) → null', () => {
    expect(estimateVo2max([{ distanceMeters: 3000, avgPaceSecPerKm: 900 }])).toBeNull();
  });

  it('escolhe o pace mais rápido plausível entre várias corridas', () => {
    const r = estimateVo2max([
      { distanceMeters: 4000, avgPaceSecPerKm: 360 },
      { distanceMeters: 4000, avgPaceSecPerKm: 300 }, // mais rápido plausível
      { distanceMeters: 4000, avgPaceSecPerKm: 420 },
    ]);
    expect(r).toBe(42.4);
  });
});
