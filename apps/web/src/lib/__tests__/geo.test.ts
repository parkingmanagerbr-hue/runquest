import { describe, it, expect } from 'vitest';
import { haversine, formatPace, formatDuration, formatDistance, speedToPace, computeSplits } from '../geo';

describe('geo helpers', () => {
  it('haversine: 1° de latitude ≈ 111.19 km', () => {
    const d = haversine([-23, -46.63], [-24, -46.63]);
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(112000);
  });

  it('haversine: mesmo ponto = 0', () => {
    expect(haversine([-23.5, -46.6], [-23.5, -46.6])).toBe(0);
  });

  it('formatPace: mm:ss com zero à esquerda', () => {
    expect(formatPace(330)).toBe('5:30');
    expect(formatPace(300)).toBe('5:00');
    expect(formatPace(65)).toBe('1:05');
  });

  it('formatPace: entradas inválidas → --:--', () => {
    expect(formatPace(0)).toBe('--:--');
    expect(formatPace(-5)).toBe('--:--');
    expect(formatPace(Infinity)).toBe('--:--');
  });

  it('formatDuration: usa horas só quando >= 1h', () => {
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(3661)).toBe('1:01:01');
    expect(formatDuration(600)).toBe('10:00');
  });

  it('formatDistance: metros → km com 2 casas', () => {
    expect(formatDistance(5230)).toBe('5.23');
    expect(formatDistance(1000)).toBe('1.00');
  });

  it('speedToPace: 1000/velocidade, 0 abaixo do limiar', () => {
    expect(speedToPace(5)).toBe(200); // 5 m/s = 3:20/km
    expect(speedToPace(0.05)).toBe(0);
  });

  it('computeSplits: rota curta (<1km) → vazio', () => {
    expect(computeSplits([[-46.63, -23.55], [-46.63, -23.5505]], 60)).toEqual([]);
  });

  // 23 pontos a 0,001° de latitude (~111 m cada) ≈ 2,4 km. Coords em [lng,lat].
  const coords = Array.from({ length: 23 }, (_, i) => [-46.63, -23.55 + i * 0.001]);

  it('computeSplits: SEM timestamps → vazio (split real é impossível, não se inventa)', () => {
    // A versão antiga devolvia 2 splits fabricados a partir da densidade de
    // pontos: com espaçamento uniforme todos saíam ~15% mais lentos que o pace
    // médio real. Agora, sem tempo por ponto, quem chama usa o fallback honesto.
    expect(computeSplits(coords, 720)).toEqual([]);
    expect(computeSplits(coords, 720, [1, 2, 3])).toEqual([]); // tamanho não bate
  });

  it('computeSplits: COM timestamps → pace real de cada km', () => {
    // Ritmo constante: 2,44 km em 732 s ≈ 300 s/km. Um ponto a cada 33,3 s.
    const t0 = 1_700_000_000_000;
    const times = coords.map((_, i) => t0 + i * 33_300);
    const splits = computeSplits(coords, 732, times);
    expect(splits.map((s) => s.km)).toEqual([1, 2]);
    // Ritmo constante ⇒ os dois splits batem ~300 s/km (tolerância do haversine).
    for (const s of splits) expect(Math.abs(s.paceSecPerKm - 300)).toBeLessThan(6);
  });

  it('computeSplits: detecta um km mais rápido que o outro (o que o usuário quer ver)', () => {
    // 1º km devagar (60 s a cada ponto), 2º km rápido (20 s a cada ponto).
    const t0 = 1_700_000_000_000;
    const times = coords.map((_, i) => t0 + (i <= 9 ? i * 60_000 : 9 * 60_000 + (i - 9) * 20_000));
    const splits = computeSplits(coords, 900, times);
    expect(splits).toHaveLength(2);
    expect(splits[0].paceSecPerKm).toBeGreaterThan(splits[1].paceSecPerKm);
  });
});
