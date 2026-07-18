/**
 * Progresso por tipo de objetivo — lógica PURA compartilhada por metas, desafios
 * e (potencialmente) missões. A contribuição de uma corrida (distance_km /
 * runs_count / duration_min) estava duplicada em goals E challenges; agora é
 * fonte única no shared kernel (DDD).
 */

export type ProgressKind = 'distance_km' | 'runs_count' | 'duration_min';

export interface RunContribution {
  distanceMeters: number;
  durationSec: number;
}

const KNOWN_KINDS: ReadonlySet<string> = new Set<ProgressKind>([
  'distance_km', 'runs_count', 'duration_min',
]);

/** O tipo é um dos objetivos suportados? (challenges pula os desconhecidos.) */
export function isKnownProgressKind(kind: string): kind is ProgressKind {
  return KNOWN_KINDS.has(kind);
}

/** Quanto uma corrida soma a um objetivo do tipo informado (desconhecido → 0). */
export function progressIncrement(kind: string, run: RunContribution): number {
  switch (kind) {
    case 'distance_km': return run.distanceMeters / 1000;
    case 'runs_count': return 1;
    case 'duration_min': return run.durationSec / 60;
    default: return 0;
  }
}

/** Novo progresso e se o objetivo foi concluído após somar a contribuição. */
export function applyProgress(
  kind: string,
  currentProgress: number,
  target: number,
  run: RunContribution,
): { progress: number; completed: boolean } {
  const progress = (currentProgress ?? 0) + progressIncrement(kind, run);
  return { progress, completed: progress >= target };
}
