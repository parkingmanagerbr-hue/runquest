import { describe, it, expect } from 'vitest';
import { routeDistanceM, routeStats, outAndBack, closeLoop, type LatLng } from '../routePlanner';

const seq: LatLng[] = [[-23.55, -46.63], [-23.549, -46.63], [-23.548, -46.63]];

describe('routeDistanceM', () => {
  it('1° de latitude ≈ 111.2 km', () => {
    expect(routeDistanceM([[-23, -46.63], [-24, -46.63]])).toBeCloseTo(111190, -3);
  });
  it('acumula por trecho', () => {
    const d1 = routeDistanceM([[-23.55, -46.63], [-23.549, -46.63]]);
    expect(routeDistanceM(seq)).toBeCloseTo(2 * d1, 0);
  });
  it('vazio/1 ponto → 0', () => {
    expect(routeDistanceM([])).toBe(0);
    expect(routeDistanceM([[1, 2]])).toBe(0);
  });
});

describe('routeStats', () => {
  it('tempo = distância × pace', () => {
    const s = routeStats(seq, 300);
    expect(s.points).toBe(3);
    expect(s.distanceM).toBe(routeDistanceM(seq));
    expect(s.estSec).toBeCloseTo(Math.round((s.distanceM / 1000) * 300), 0);
  });
  it('pace 0 → tempo 0, sem NaN', () => {
    expect(routeStats(seq, 0).estSec).toBe(0);
  });
});

describe('outAndBack', () => {
  it('dobra a distância, 2n-1 pontos', () => {
    const ob = outAndBack(seq);
    expect(ob.length).toBe(2 * seq.length - 1);
    // ±1 m: routeDistanceM arredonda o total, então round(2x) pode diferir de 2·round(x).
    expect(Math.abs(routeDistanceM(ob) - 2 * routeDistanceM(seq))).toBeLessThanOrEqual(1);
  });
  it('1 ponto → inalterado', () => {
    expect(outAndBack([[1, 2]]).length).toBe(1);
  });
});

describe('closeLoop', () => {
  it('fecha voltando ao início', () => {
    const loop = closeLoop(seq);
    expect(loop.length).toBe(seq.length + 1);
    expect(loop[loop.length - 1]).toEqual(seq[0]);
  });
  it('já fechado → não duplica', () => {
    expect(closeLoop(closeLoop(seq)).length).toBe(seq.length + 1);
  });
  it('<3 pontos → inalterado', () => {
    expect(closeLoop([[1, 2], [3, 4]]).length).toBe(2);
  });
});
