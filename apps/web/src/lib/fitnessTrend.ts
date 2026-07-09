/**
 * EVOLUÇÃO DE FORMA — "estou ficando mais rápido?"
 *
 * Das corridas reais (distância/tempo/data), estima o 5K equivalente (Riegel)
 * semana a semana usando uma janela móvel de 3 semanas (a forma reflete o
 * melhor esforço recente), calcula o volume semanal e a TENDÊNCIA por regressão
 * linear no 5K estimado. Só usa dados que já existem — honesto e puro.
 */

import { riegelPredict, type RunLite } from './trainingPaces';

const WEEK_MS = 7 * 86400000;

export interface WeekPoint {
  weekStartMs: number; // início do bucket (7 dias)
  km: number;
  runs: number;
  est5kSec: number | null; // melhor 5K estimado na janela móvel (menor = melhor)
}

export interface FitnessTrend {
  weeks: WeekPoint[]; // do mais antigo ao mais recente
  trend: 'improving' | 'flat' | 'declining' | 'insufficient';
  deltaSecPerWeek: number; // inclinação do 5K estimado (negativo = mais rápido)
  best5kSec: number | null;
  latest5kSec: number | null;
  totalKm: number;
}

/** Predição de 5K de uma corrida (só corridas de esforço ≥1,5 km). */
function predicted5k(r: RunLite): number | null {
  if (!(r.distanceMeters >= 1500) || !(r.durationSec > 0)) return null;
  const p = riegelPredict(r.distanceMeters, r.durationSec, 5000);
  return p > 0 ? p : null;
}

export function computeFitnessTrend(runs: RunLite[], now: number, weeks = 12): FitnessTrend {
  const nWeeks = Math.max(1, weeks);
  // bucket 0 = mais antigo; nWeeks-1 = semana atual
  const km = new Array(nWeeks).fill(0);
  const runCount = new Array(nWeeks).fill(0);
  const preds: number[][] = Array.from({ length: nWeeks }, () => []);
  const nowWeekStart = now - (now % WEEK_MS); // alinhado ao epoch (7d)

  for (const r of runs || []) {
    const t = Date.parse(r.startedAt);
    if (isNaN(t) || !(r.distanceMeters > 0)) continue;
    const ageWeeks = Math.floor((nowWeekStart - (t - (t % WEEK_MS))) / WEEK_MS);
    if (ageWeeks < 0 || ageWeeks >= nWeeks) continue;
    const bi = nWeeks - 1 - ageWeeks;
    km[bi] += r.distanceMeters / 1000;
    runCount[bi] += 1;
    const p = predicted5k(r);
    if (p != null) preds[bi].push(p);
  }

  const points: WeekPoint[] = [];
  for (let wi = 0; wi < nWeeks; wi++) {
    // janela móvel de 3 semanas (wi-2..wi) → melhor 5K
    let best: number | null = null;
    for (let j = Math.max(0, wi - 2); j <= wi; j++) {
      for (const p of preds[j]) if (best == null || p < best) best = p;
    }
    points.push({
      weekStartMs: nowWeekStart - (nWeeks - 1 - wi) * WEEK_MS,
      km: Math.round(km[wi] * 10) / 10,
      runs: runCount[wi],
      est5kSec: best != null ? Math.round(best) : null,
    });
  }

  // Regressão linear sobre as semanas COM estimativa (x = índice, y = 5K seg)
  const pts = points.map((p, i) => ({ x: i, y: p.est5kSec })).filter((p): p is { x: number; y: number } => p.y != null);
  let slope = 0;
  let trend: FitnessTrend['trend'] = 'insufficient';
  if (pts.length >= 3) {
    const n = pts.length;
    const sx = pts.reduce((a, p) => a + p.x, 0);
    const sy = pts.reduce((a, p) => a + p.y, 0);
    const sxx = pts.reduce((a, p) => a + p.x * p.x, 0);
    const sxy = pts.reduce((a, p) => a + p.x * p.y, 0);
    const denom = n * sxx - sx * sx;
    slope = denom !== 0 ? (n * sxy - sx * sy) / denom : 0;
    trend = slope < -1 ? 'improving' : slope > 1 ? 'declining' : 'flat';
  }

  const allPreds = pts.map((p) => p.y);
  const best5kSec = allPreds.length ? Math.min(...allPreds) : null;
  const latest5kSec = [...points].reverse().find((p) => p.est5kSec != null)?.est5kSec ?? null;
  const totalKm = Math.round(points.reduce((a, p) => a + p.km, 0) * 10) / 10;

  return { weeks: points, trend, deltaSecPerWeek: Math.round(slope * 10) / 10, best5kSec, latest5kSec, totalKm };
}
