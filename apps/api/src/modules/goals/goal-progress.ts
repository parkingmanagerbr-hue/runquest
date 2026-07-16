/**
 * Progresso de meta — lógica PURA (sem Prisma), extraída do GoalProgressService.
 * A contribuição de uma corrida por tipo de meta estava inline e duplicada
 * (aplicação pós-run + cálculo inicial na criação). Aqui fica testável.
 */

export type GoalKind = 'distance_km' | 'runs_count' | 'duration_min';

export interface GoalRunContribution {
  distanceMeters: number;
  durationSec: number;
}

/** Quanto uma corrida soma a uma meta do tipo informado (tipo desconhecido → 0). */
export function goalIncrement(kind: string, run: GoalRunContribution): number {
  switch (kind) {
    case 'distance_km': return run.distanceMeters / 1000;
    case 'runs_count': return 1;
    case 'duration_min': return run.durationSec / 60;
    default: return 0;
  }
}

/** Novo progresso e se a meta foi concluída após somar a contribuição da corrida. */
export function applyGoalProgress(
  kind: string,
  currentProgress: number,
  target: number,
  run: GoalRunContribution,
): { progress: number; completed: boolean } {
  const progress = (currentProgress ?? 0) + goalIncrement(kind, run);
  return { progress, completed: progress >= target };
}
