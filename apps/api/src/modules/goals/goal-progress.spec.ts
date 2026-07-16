import { goalIncrement, applyGoalProgress } from './goal-progress';

const run = { distanceMeters: 5000, durationSec: 1800 }; // 5 km, 30 min

describe('goalIncrement', () => {
  it('distance_km → km da corrida', () => {
    expect(goalIncrement('distance_km', run)).toBe(5);
  });
  it('runs_count → 1', () => {
    expect(goalIncrement('runs_count', run)).toBe(1);
  });
  it('duration_min → minutos da corrida', () => {
    expect(goalIncrement('duration_min', run)).toBe(30);
  });
  it('tipo desconhecido → 0 (não contamina o progresso)', () => {
    expect(goalIncrement('calories', run)).toBe(0);
    expect(goalIncrement('', run)).toBe(0);
  });
});

describe('applyGoalProgress', () => {
  it('soma a contribuição ao progresso atual', () => {
    expect(applyGoalProgress('distance_km', 3, 10, run)).toEqual({ progress: 8, completed: false });
  });
  it('conclui ao atingir o alvo (>=)', () => {
    expect(applyGoalProgress('distance_km', 5, 10, run)).toEqual({ progress: 10, completed: true });
    expect(applyGoalProgress('distance_km', 8, 10, run)).toEqual({ progress: 13, completed: true });
  });
  it('progresso nulo é tratado como 0', () => {
    expect(applyGoalProgress('runs_count', undefined as any, 3, run)).toEqual({ progress: 1, completed: false });
  });
});
