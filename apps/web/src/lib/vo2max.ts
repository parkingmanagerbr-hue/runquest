/**
 * Estimativa de VO2max pelo método de Cooper a partir do melhor pace sustentável.
 * PURA e testável. Corrige o bug do componente de stats: `floor(n*0.1)===0` para
 * menos de 10 corridas selecionava o pace único mais rápido — que quase sempre é
 * um glitch de GPS (ex.: 1:30/km). Aqui os outliers implausíveis são descartados
 * ANTES da seleção, então "o mais rápido" é sempre um esforço real.
 */

export interface Vo2Sample {
  distanceMeters: number;
  avgPaceSecPerKm: number;
}

const MIN_PLAUSIBLE_PACE = 140; // 2:20/km — abaixo disso é erro de GPS, não corrida
const MIN_DISTANCE_M = 2000; // distância mínima p/ um pace representativo
const MIN_PLAUSIBLE_VO2 = 20; // abaixo disso a estimativa não é confiável

/** VO2max estimado (1 casa decimal) ou null se não houver amostra confiável. */
export function estimateVo2max(samples: Vo2Sample[]): number | null {
  const valid = samples.filter(
    (s) => s.distanceMeters >= MIN_DISTANCE_M && s.avgPaceSecPerKm >= MIN_PLAUSIBLE_PACE,
  );
  if (valid.length === 0) return null;

  // Outliers já removidos → o mais rápido é um melhor-esforço legítimo.
  const bestPace = Math.min(...valid.map((s) => s.avgPaceSecPerKm)); // s/km
  const speedMPerMin = 60000 / bestPace; // m/min
  const dist12min = speedMPerMin * 12; // distância em 12 min (teste de Cooper)
  const vo2 = (dist12min - 504.9) / 44.73;

  if (vo2 < MIN_PLAUSIBLE_VO2) return null;
  return Math.round(vo2 * 10) / 10;
}
