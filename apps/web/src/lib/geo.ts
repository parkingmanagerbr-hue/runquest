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

/** Pace por km a partir de coordenadas [lng,lat] + duração total. */
export function computeSplits(coordinates: number[][], totalDurationSec: number) {
  if (!coordinates || coordinates.length < 2) return [] as { km: number; paceSecPerKm: number }[];
  const cumDist: number[] = [0];
  for (let i = 1; i < coordinates.length; i++) {
    cumDist.push(cumDist[i - 1] + haversine(
      [coordinates[i - 1][1], coordinates[i - 1][0]],
      [coordinates[i][1], coordinates[i][0]],
    ));
  }
  const total = cumDist[cumDist.length - 1];
  if (total < 1000) return [];
  const totalKm = Math.floor(total / 1000);
  const splits: { km: number; paceSecPerKm: number }[] = [];
  for (let k = 1; k <= totalKm; k++) {
    const idx = cumDist.findIndex(d => d >= k * 1000);
    const prevIdx = cumDist.findIndex(d => d >= (k - 1) * 1000);
    const segPoints = Math.max(1, idx - prevIdx);
    const avgSegPoints = Math.max(1, coordinates.length / totalKm);
    const variation = 0.85 + (segPoints / avgSegPoints) * 0.3; // 0.85x..1.15x
    const pace = (totalDurationSec / (total / 1000)) * variation;
    splits.push({ km: k, paceSecPerKm: Math.round(pace) });
  }
  return splits;
}
