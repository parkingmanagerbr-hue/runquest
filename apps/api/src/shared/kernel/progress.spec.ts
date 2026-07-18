import { progressIncrement, applyProgress, isKnownProgressKind } from './progress';

const run = { distanceMeters: 5000, durationSec: 1800 }; // 5 km, 30 min

describe('progressIncrement', () => {
  it('distance_km → km da corrida', () => {
    expect(progressIncrement('distance_km', run)).toBe(5);
  });
  it('runs_count → 1', () => {
    expect(progressIncrement('runs_count', run)).toBe(1);
  });
  it('duration_min → minutos da corrida', () => {
    expect(progressIncrement('duration_min', run)).toBe(30);
  });
  it('tipo desconhecido → 0 (não contamina o progresso)', () => {
    expect(progressIncrement('calories', run)).toBe(0);
    expect(progressIncrement('', run)).toBe(0);
  });
});

describe('isKnownProgressKind', () => {
  it('reconhece os três tipos suportados', () => {
    expect(isKnownProgressKind('distance_km')).toBe(true);
    expect(isKnownProgressKind('runs_count')).toBe(true);
    expect(isKnownProgressKind('duration_min')).toBe(true);
  });
  it('rejeita tipo desconhecido (challenges pula esses)', () => {
    expect(isKnownProgressKind('calories')).toBe(false);
    expect(isKnownProgressKind('')).toBe(false);
  });
});

describe('applyProgress', () => {
  it('soma a contribuição ao progresso atual', () => {
    expect(applyProgress('distance_km', 3, 10, run)).toEqual({ progress: 8, completed: false });
  });
  it('conclui ao atingir o alvo (>=)', () => {
    expect(applyProgress('distance_km', 5, 10, run)).toEqual({ progress: 10, completed: true });
    expect(applyProgress('distance_km', 8, 10, run)).toEqual({ progress: 13, completed: true });
  });
  it('progresso nulo é tratado como 0', () => {
    expect(applyProgress('runs_count', undefined as unknown as number, 3, run)).toEqual({ progress: 1, completed: false });
  });
});
