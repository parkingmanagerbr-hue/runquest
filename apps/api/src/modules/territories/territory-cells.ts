import { latLngToCell } from 'h3-js';

/**
 * Regras PURAS de território — extraídas do TerritoryService para serem testáveis
 * sem Prisma. A conversão de trajeto→células e a decisão de captura são o núcleo
 * da mecânica de conquista (o usuário ganha/perde território de verdade).
 */

export const H3_RES = 9; // ~150 m por célula
export const VISITS_TO_CAPTURE = 3;
export const EXPIRY_DAYS = 21;

/**
 * Células H3 únicas de um trajeto. `points` vem em GeoJSON `[lng, lat]`; a h3-js
 * espera `(lat, lng)`. Pontos inválidos (NaN, faltando) são descartados — antes,
 * um ponto ruim borbulhava a exceção da h3-js para fora do laço.
 */
export function pointsToCells(points: number[][]): Set<string> {
  const cells = new Set<string>();
  if (!Array.isArray(points)) return cells;
  for (const c of points) {
    if (!Array.isArray(c) || c.length < 2 || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
    const lng = c[0];
    const lat = c[1];
    // A h3-js NÃO valida o intervalo: latLngToCell(999, 999) devolve uma célula
    // em vez de lançar. Sem esta guarda, um glitch de GPS com coordenada absurda
    // viraria um "território" fantasma do outro lado do mundo.
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    try {
      cells.add(latLngToCell(lat, lng, H3_RES));
    } catch {
      /* defensivo: qualquer outra recusa da h3-js */
    }
  }
  return cells;
}

/**
 * Esta visita captura a célula? Só quando ela ainda NÃO estava capturada e o novo
 * total de visitas atinge o limiar. Idempotente: uma célula já capturada nunca
 * "captura de novo".
 */
export function capturesOnThisVisit(currentVisits: number, alreadyCaptured: boolean): boolean {
  if (alreadyCaptured) return false;
  return currentVisits + 1 >= VISITS_TO_CAPTURE;
}
