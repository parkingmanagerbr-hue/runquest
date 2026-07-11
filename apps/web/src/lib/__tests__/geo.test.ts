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
});
