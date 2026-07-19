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

  it('amostra pequena (4 sem) com tendência fraca+ruído → flat (corte por df, não t≥2)', () => {
    // slope=-11.5, t=-2.90, df=2. Com t-crítico correto (4.30) NÃO é significativo;
    // com o corte ingênuo 2.0 seria "improving" falso. 4 pontos ruidosos ≠ tendência.
    const durs = [1505, 1485, 1490, 1465]; // do mais antigo (w=3) ao atual (w=0)
    const runs = durs.map((d, i) => ({ distanceMeters: 5000, durationSec: d, startedAt: daysAgo((3 - i) * 7 + 1) }));
    expect(computeFitnessTrend(runs, now, 12).trend).toBe('flat');
  });

  it('descarta outlier de GPS (5K em 8min = 1:36/km) — não vira o melhor', () => {
    const t = computeFitnessTrend([
      { distanceMeters: 5000, durationSec: 1500, startedAt: daysAgo(3) }, // 5:00/km real
      { distanceMeters: 5000, durationSec: 480, startedAt: daysAgo(5) },  // glitch impossível
    ], now, 12);
    expect(t.best5kSec).toBeGreaterThan(1000); // não pegou o glitch de 480s
  });
});

describe('computeFitnessTrend — bordas estatísticas', () => {
  it('melhora perfeitamente linear → significativa (t=±∞), trend improving', () => {
    // Uma corrida por semana, cada semana exatamente 15 s mais rápida: ajuste
    // perfeito (r²=1, sem erro residual) ⇒ seSlope 0 ⇒ |t|=Infinity ⇒ significativo.
    const runs = [];
    for (let w = 6; w >= 0; w--) {
      runs.push({ distanceMeters: 5000, durationSec: 1500 + w * 15, startedAt: daysAgo(w * 7 + 1) });
    }
    const t = computeFitnessTrend(runs, now, 8);
    expect(t.trend).toBe('improving');
    expect(t.r2).toBe(1); // ajuste perfeito
  });

  it('descarta corridas com data inválida ou distância <= 0', () => {
    const runs = [
      { distanceMeters: 5000, durationSec: 1500, startedAt: 'lixo' },
      { distanceMeters: 0, durationSec: 1500, startedAt: daysAgo(3) },
      { distanceMeters: 5000, durationSec: 1500, startedAt: daysAgo(3) },
    ];
    const t = computeFitnessTrend(runs, now, 8);
    // Só a 3ª corrida conta — não quebra, e produz um best5kSec finito.
    expect(t.best5kSec).not.toBeNull();
    expect(Number.isFinite(t.best5kSec as number)).toBe(true);
  });

  it('sem corridas → tendência insufficient e sem recordes', () => {
    const t = computeFitnessTrend([], now, 8);
    expect(t.trend).toBe('insufficient'); // não "flat" — não há dado para julgar
    expect(t.best5kSec).toBeNull();
  });
});
