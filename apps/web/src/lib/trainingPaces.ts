/**
 * Motor de PACES DE TREINO personalizados — a base do coaching adaptativo.
 *
 * A partir das corridas reais do usuário, estima a forma atual (tempo
 * equivalente de 5K via fórmula de Riegel) e deriva as faixas de ritmo de
 * treino (recuperação, fácil, maratona, limiar/tempo, intervalado, repetição).
 * É o que o INTVL faz de melhor: dizer EXATAMENTE em que pace correr cada bloco.
 *
 * Zero dependência de rede — funções puras, fáceis de testar.
 */

export interface RunLite {
  distanceMeters: number;
  durationSec: number;
  startedAt: string;
}

export type PaceZone = 'recovery' | 'easy' | 'marathon' | 'threshold' | 'interval' | 'repetition';

export interface TrainingPaces {
  ref5kSec: number; // tempo equivalente de 5K estimado (s)
  paces: Record<PaceZone, number>; // s/km por zona
  source: 'runs' | 'manual' | 'none';
}

/** Riegel: T2 = T1 × (D2/D1)^1.06 (expoente empírico de fadiga). */
export function riegelPredict(refDistM: number, refDurSec: number, targetDistM: number): number {
  if (refDistM <= 0 || refDurSec <= 0) return 0;
  return refDurSec * Math.pow(targetDistM / refDistM, 1.06);
}

// Offsets (s/km) de cada zona relativos ao pace de 5K. Aproximação estilo
// Daniels: intervalado ≈ pace de 5K, limiar mais lento, fácil bem mais lento.
const ZONE_OFFSET: Record<PaceZone, number> = {
  repetition: -18,
  interval: -4,
  threshold: 18,
  marathon: 35,
  easy: 70,
  recovery: 95,
};

function pacesFrom5k(ref5kSec: number): Record<PaceZone, number> {
  const p5 = ref5kSec / 5; // s/km no ritmo de 5K
  const out = {} as Record<PaceZone, number>;
  (Object.keys(ZONE_OFFSET) as PaceZone[]).forEach((z) => {
    out[z] = Math.max(120, Math.round(p5 + ZONE_OFFSET[z])); // nunca < 2:00/km
  });
  return out;
}

/**
 * Estima a forma atual a partir do histórico: para cada corrida "de esforço"
 * (≥1,5 km), projeta o 5K equivalente por Riegel e pega o MELHOR (mais rápido),
 * dando leve preferência a corridas recentes (janela de 90 dias).
 */
export function estimatePaces(runs: RunLite[], now = 0): TrainingPaces {
  const NONE: TrainingPaces = { ref5kSec: 0, paces: pacesFrom5k(1500), source: 'none' };
  if (!runs?.length) return NONE;
  const nowMs = now || parseDateSafe(runs[0]?.startedAt) || 0;

  let best = Infinity;
  for (const r of runs) {
    if (!(r.distanceMeters >= 1500) || !(r.durationSec > 0)) continue;
    const pred = riegelPredict(r.distanceMeters, r.durationSec, 5000);
    if (pred <= 0) continue;
    // penaliza corridas antigas (> 90 dias) em ~1% por mês além disso
    const ageDays = nowMs ? Math.max(0, (nowMs - parseDateSafe(r.startedAt)) / 86400000) : 0;
    const penalty = ageDays > 90 ? 1 + (ageDays - 90) / 3000 : 1;
    const adjusted = pred * penalty;
    if (adjusted < best) best = adjusted;
  }
  if (!isFinite(best)) return NONE;
  return { ref5kSec: Math.round(best), paces: pacesFrom5k(best), source: 'runs' };
}

/** Paces a partir de um tempo de referência manual (ex.: uma prova recente). */
export function pacesFromReference(refDistM: number, refDurSec: number): TrainingPaces {
  const ref5k = riegelPredict(refDistM, refDurSec, 5000);
  if (ref5k <= 0) return { ref5kSec: 0, paces: pacesFrom5k(1500), source: 'none' };
  return { ref5kSec: Math.round(ref5k), paces: pacesFrom5k(ref5k), source: 'manual' };
}

export const ZONE_LABEL: Record<PaceZone, string> = {
  recovery: 'Recuperação',
  easy: 'Fácil',
  marathon: 'Maratona',
  threshold: 'Limiar (tempo)',
  interval: 'Intervalado',
  repetition: 'Repetição',
};

function parseDateSafe(s: string | undefined): number {
  if (!s) return 0;
  const t = Date.parse(s);
  return isNaN(t) ? 0 : t;
}
