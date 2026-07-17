/** Haversine distance entre 2 pontos em metros. */
export function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatPace(secPerKm: number): string {
  if (!isFinite(secPerKm) || secPerKm <= 0) return '--:--';
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDistance(m: number): string {
  return (m / 1000).toFixed(2);
}

/** Convert GPS speed (m/s) to pace (sec/km) */
export function speedToPace(speedMs: number): number {
  if (speedMs <= 0.1) return 0;
  return Math.round(1000 / speedMs);
}

export interface Split {
  km: number;
  paceSecPerKm: number;
}

/**
 * Pace real de cada km a partir das coordenadas [lng,lat] E do timestamp (ms)
 * de cada ponto. Sem timestamps NÃO existe split real — a distância sozinha não
 * diz quando cada km foi percorrido — então a função devolve `[]` e quem chama
 * cai no fallback honesto (pace médio uniforme).
 *
 * NÃO invente variação aqui. A versão anterior fazia
 *   pace = paceMédio × (0.85 + densidadeDePontos × 0.3)
 * ou seja, fabricava splits a partir da densidade de pontos do GPS: com
 * espaçamento uniforme (o caso normal) o fator dava 1.15 e TODO split saía ~15%
 * mais lento que o pace médio exibido na mesma tela. O usuário via "km 3 mais
 * rápido que o km 5" sem que isso tivesse qualquer relação com a corrida.
 */
export function computeSplits(
  coordinates: number[][],
  totalDurationSec: number,
  pointTimesMs?: number[],
): Split[] {
  if (!coordinates || coordinates.length < 2) return [];
  // Sem um timestamp por ponto, split real é matematicamente impossível.
  if (!pointTimesMs || pointTimesMs.length !== coordinates.length) return [];
  void totalDurationSec;

  const cumDist: number[] = [0];
  for (let i = 1; i < coordinates.length; i++) {
    cumDist.push(cumDist[i - 1] + haversine(
      [coordinates[i - 1][1], coordinates[i - 1][0]],
      [coordinates[i][1], coordinates[i][0]],
    ));
  }
  const total = cumDist[cumDist.length - 1];
  if (total < 1000) return [];

  const splits: Split[] = [];
  const totalKm = Math.floor(total / 1000);
  for (let k = 1; k <= totalKm; k++) {
    // Instante em que cada marca de km foi cruzada, interpolado entre os
    // dois pontos que a cercam.
    const tEnd = crossingTimeMs(cumDist, pointTimesMs, k * 1000);
    const tStart = crossingTimeMs(cumDist, pointTimesMs, (k - 1) * 1000);
    if (tEnd === null || tStart === null || tEnd <= tStart) return [];
    splits.push({ km: k, paceSecPerKm: Math.round((tEnd - tStart) / 1000) });
  }
  return splits;
}

/** Instante (ms) em que a distância acumulada cruza `target`, interpolado. */
function crossingTimeMs(cumDist: number[], times: number[], target: number): number | null {
  if (target <= 0) return times[0];
  const i = cumDist.findIndex((d) => d >= target);
  if (i <= 0) return null;
  const segDist = cumDist[i] - cumDist[i - 1];
  const frac = segDist > 0 ? (target - cumDist[i - 1]) / segDist : 0;
  return times[i - 1] + (times[i] - times[i - 1]) * frac;
}
