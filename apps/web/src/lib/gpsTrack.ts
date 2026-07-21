/**
 * Filtros de sinal de GPS — lógica PURA da qualidade de rastro, extraída do
 * componente de corrida (God component). São o que separa uma distância/pace
 * confiável de lixo: sem o gate de precisão e o filtro de jitter/teleporte, um
 * fix ruim de GPS injeta metros fantasmas na métrica central do app.
 */

export const MAX_HORIZONTAL_ACCURACY_M = 35; // acima disso o fix é impreciso demais
export const MIN_STEP_M = 1.5; // passo menor = jitter parado (não anda)
export const MAX_STEP_M = 60; // passo maior = salto/teleporte de GPS
export const MAX_ALT_ACCURACY_M = 25; // altitude imprecisa não conta elevação
export const MIN_ALT_DELTA_M = 0.3; // ruído de barômetro/GPS vertical
export const MAX_ALT_DELTA_M = 30; // degrau grande demais = glitch

/** O fix tem precisão horizontal suficiente para contar distância? */
export function isAcceptableFix(accuracy: number): boolean {
  return accuracy <= MAX_HORIZONTAL_ACCURACY_M;
}

/**
 * Distância (m) a somar entre dois fixes consecutivos, ou null se o passo for
 * jitter (parado) ou salto (teleporte). Recebe a distância já calculada.
 */
export function acceptStep(distMeters: number): number | null {
  if (distMeters < MIN_STEP_M || distMeters > MAX_STEP_M) return null;
  return distMeters;
}

/**
 * Ganho/perda de elevação a partir de um par de altitudes, aplicando o gate de
 * precisão vertical e a banda de delta plausível. Sempre retorna incrementos ≥ 0.
 */
export function elevationStep(
  prevAlt: number | null,
  alt: number | null,
  altAccuracy: number | null,
): { gain: number; loss: number } {
  const none = { gain: 0, loss: 0 };
  if (prevAlt == null || alt == null) return none;
  if (!(altAccuracy == null || altAccuracy < MAX_ALT_ACCURACY_M)) return none;
  const delta = alt - prevAlt;
  const mag = Math.abs(delta);
  if (mag <= MIN_ALT_DELTA_M || mag >= MAX_ALT_DELTA_M) return none;
  return delta > 0 ? { gain: delta, loss: 0 } : { gain: 0, loss: mag };
}

/** Pace (s/km) de um quilômetro recém-completado. */
export function splitPace(durSec: number, prevDurSec: number, distM: number, prevDistM: number): number {
  return Math.round(((durSec - prevDurSec) * 1000) / (distM - prevDistM));
}

/**
 * Duração decorrida (s) pelo RELÓGIO: base acumulada + (agora − início do
 * segmento). Fonte única do cálculo que sobrevive ao throttle de setInterval em
 * background — e que precisa ser "flushado" ao pausar/parar, senão perde-se a
 * fração desde o último tick de 1 s.
 */
export function elapsedSec(baseSec: number, segStartMs: number, nowMs: number): number {
  return baseSec + Math.round((nowMs - segStartMs) / 1000);
}

/** Barras de sinal (0–4) a partir da precisão do fix — 0 quando não há GPS. */
export function gpsSignal(accuracy: number | null): 0 | 1 | 2 | 3 | 4 {
  if (!accuracy) return 0;
  if (accuracy <= 5) return 4;
  if (accuracy <= 10) return 3;
  if (accuracy <= 20) return 2;
  if (accuracy <= 40) return 1;
  return 0;
}
