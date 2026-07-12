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

  // ── Boas práticas de estatística/ML ────────────────────────────────────────
  it('UMA semana rápida entre semanas planas NÃO vira "melhorando" (fix de autocorrelação)', () => {
    // 9 semanas planas (1500s) exceto UMA rápida (1200s) 3 semanas atrás. Com a
    // série suavizada de 3 semanas, esse pico se propagaria p/ 3 semanas recentes
    // e a regressão diria "melhorando" — falso. Sobre os melhores-por-semana
    // independentes, é só 1 ponto → sem significância → flat.
    const runs = [];
    for (let w = 8; w >= 0; w--) {
      runs.push({ distanceMeters: 5000, durationSec: w === 2 ? 1200 : 1500, startedAt: daysAgo(w * 7 + 1) });
    }
    const t = computeFitnessTrend(runs, now, 12);
    expect(t.trend).toBe('flat'); // um pico isolado não é tendência
    expect(t.r2).toBeLessThan(0.6); // ajuste ruim
  });

  it('tendência limpa e forte → R² alto', () => {
    const runs = [];
    for (let w = 8; w >= 0; w--) runs.push({ distanceMeters: 5000, durationSec: 1600 - (8 - w) * 20, startedAt: daysAgo(w * 7 + 1) });
    expect(computeFitnessTrend(runs, now, 12).r2).toBeGreaterThan(0.9);
  });

  it('dados ruidosos sem tendência → flat (não superinterpreta ruído)', () => {
    const noisy = [1500, 1450, 1520, 1480, 1510, 1490, 1505, 1495, 1500];
    const runs = noisy.map((d, i) => ({ distanceMeters: 5000, durationSec: d, startedAt: daysAgo((8 - i) * 7 + 1) }));
    const t = computeFitnessTrend(runs, now, 12);
    expect(t.trend).toBe('flat');
  });

  it('descarta outlier de GPS (5K em 8min = 1:36/km) — não vira o melhor', () => {
    const t = computeFitnessTrend([
      { distanceMeters: 5000, durationSec: 1500, startedAt: daysAgo(3) }, // 5:00/km real
      { distanceMeters: 5000, durationSec: 480, startedAt: daysAgo(5) },  // glitch impossível
    ], now, 12);
    expect(t.best5kSec).toBeGreaterThan(1000); // não pegou o glitch de 480s
  });
});
