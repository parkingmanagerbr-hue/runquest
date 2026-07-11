import { describe, it, expect } from 'vitest';
import { computeFitnessTrend } from '../fitnessTrend';

const now = Date.parse('2026-07-06T12:00:00Z');
const daysAgo = (d: number) => new Date(now - d * 86400000).toISOString();

describe('computeFitnessTrend', () => {
  it('5K caindo ao longo das semanas → improving (slope negativo)', () => {
    const runs = [];
    for (let w = 8; w >= 0; w--) runs.push({ distanceMeters: 5000, durationSec: 1600 - (8 - w) * 20, startedAt: daysAgo(w * 7 + 1) });
    const t = computeFitnessTrend(runs, now, 12);
    expect(t.trend).toBe('improving');
    expect(t.deltaSecPerWeek).toBeLessThan(0);
    expect(t.best5kSec).not.toBeNull();
    expect(t.best5kSec!).toBeLessThanOrEqual((t.latest5kSec ?? 0) + 1);
    expect(t.weeks.length).toBe(12);
    expect(t.totalKm).toBeGreaterThan(0);
  });

  it('5K subindo → declining (slope positivo)', () => {
    const runs = [];
    for (let w = 8; w >= 0; w--) runs.push({ distanceMeters: 5000, durationSec: 1400 + (8 - w) * 25, startedAt: daysAgo(w * 7 + 1) });
    const t = computeFitnessTrend(runs, now, 12);
    expect(t.trend).toBe('declining');
    expect(t.deltaSecPerWeek).toBeGreaterThan(0);
  });

  it('5K constante → flat', () => {
    const runs = [];
    for (let w = 8; w >= 0; w--) runs.push({ distanceMeters: 5000, durationSec: 1500, startedAt: daysAgo(w * 7 + 1) });
    expect(computeFitnessTrend(runs, now, 12).trend).toBe('flat');
  });

  it('1 corrida → insufficient (mas ainda estima 5K)', () => {
    const t = computeFitnessTrend([{ distanceMeters: 5000, durationSec: 1500, startedAt: daysAgo(3) }], now, 12);
    expect(t.trend).toBe('insufficient');
    expect(t.best5kSec).not.toBeNull();
  });

  it('vazio → tudo zerado, sem crash', () => {
    const t = computeFitnessTrend([], now, 12);
    expect(t.trend).toBe('insufficient');
    expect(t.best5kSec).toBeNull();
    expect(t.totalKm).toBe(0);
  });

  it('bucketing: corrida de ontem cai na semana atual; anteriores vazias', () => {
    const t = computeFitnessTrend([{ distanceMeters: 10000, durationSec: 3000, startedAt: daysAgo(1) }], now, 12);
    expect(t.weeks[11].km).toBe(10);
    expect(t.weeks[11].runs).toBe(1);
    expect(t.weeks.slice(0, -1).every((w) => w.runs === 0)).toBe(true);
  });

  it('corrida fora da janela (140 dias) é ignorada', () => {
    expect(computeFitnessTrend([{ distanceMeters: 5000, durationSec: 1500, startedAt: daysAgo(140) }], now, 12).totalKm).toBe(0);
  });

  it('ignora corridas curtas/sujas na estimativa', () => {
    const t = computeFitnessTrend([
      { distanceMeters: 800, durationSec: 200, startedAt: daysAgo(1) },
      { distanceMeters: 0, durationSec: 0, startedAt: 'lixo' },
    ], now, 12);
    expect(t.best5kSec).toBeNull();
  });
});
