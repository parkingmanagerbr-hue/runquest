/**
 * Estimativa de calorias de corrida — fonte ÚNICA da fórmula, antes duplicada em
 * 4 telas (run, detalhe da corrida, detalhe público e stats) com o peso ora real
 * ora fixo em 70. Aproximação clássica: ~1,036 kcal por kg por km.
 */

export const DEFAULT_WEIGHT_KG = 70; // usado quando o peso do usuário é desconhecido
const KCAL_PER_KG_PER_KM = 1.036;

/** Calorias estimadas (inteiro) para uma distância em metros e um peso em kg. */
export function estimateCalories(distanceMeters: number, weightKg: number = DEFAULT_WEIGHT_KG): number {
  const km = distanceMeters / 1000;
  const w = weightKg > 0 ? weightKg : DEFAULT_WEIGHT_KG;
  return Math.round(km * w * KCAL_PER_KG_PER_KM);
}
