/**
 * EVOLUÇÃO DE FORMA — "estou ficando mais rápido?"
 *
 * Das corridas reais (distância/tempo/data), estima o 5K equivalente (Riegel)
 * por semana e calcula a TENDÊNCIA por regressão linear.
 *
 * Boas práticas de estatística/ML aplicadas:
 *  - Limpeza de dado: descarta outliers (glitch de GPS) via isPlausibleEffort.
 *  - Independência: a regressão roda sobre o MELHOR DE CADA SEMANA (observações
 *    independentes), NÃO sobre a série suavizada de 3 semanas — carregar o mesmo
 *    valor pra frente autocorrelaciona os pontos e enviesa a inclinação.
 *  - Significância: só declara improving/declining se a inclinação for
 *    estatisticamente significativa (|t| ≥ 2) E |slope| relevante; senão "flat".
 *    Reporta R² para transparência. A série suavizada fica só para o gráfico.
 */

import { riegelPredict, isPlausibleEffort, type RunLite } from './trainingPaces';

const WEEK_MS = 7 * 86400000;

export interface WeekPoint {
  weekStartMs: number; // início do bucket (7 dias)
  km: number;
  runs: number;
  est5kSec: number | null; // 5K estimado suavizado (janela 3 sem) — só p/ o gráfico
}

export interface FitnessTrend {
  weeks: WeekPoint[]; // do mais antigo ao mais recente
  trend: 'improving' | 'flat' | 'declining' | 'insufficient';
  deltaSecPerWeek: number; // inclinação do 5K estimado (negativo = mais rápido)
  r2: number; // qualidade do ajuste (0..1); baixo = ruidoso/sem tendência clara
  best5kSec: number | null;
  latest5kSec: number | null;
  totalKm: number;
}

/** t crítico de Student (95% bicaudal) por graus de liberdade. Amostra pequena
 *  exige t bem maior que o 1.96 assintótico — evita superdeclarar tendência. */
const T95: Record<number, number> = {
  1: 12.71, 2: 4.30, 3: 3.18, 4: 2.78, 5: 2.57, 6: 2.45, 7: 2.36, 8: 2.31, 9: 2.26, 10: 2.23,
};
export function tCritical95(df: number): number {
  if (df <= 0) return Infinity;
  if (df <= 10) return T95[df];
  if (df <= 20) return 2.09;
  if (df <= 30) return 2.04;
  return 1.98;
}

/** Predição de 5K de uma corrida de esforço plausível (senão null). */
function predicted5k(r: RunLite): number | null {
  if (!isPlausibleEffort(r)) return null;
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

  // Melhor 5K REAL de cada semana (observação independente p/ a regressão).
  const rawBest: (number | null)[] = preds.map((arr) => (arr.length ? Math.min(...arr) : null));

  const points: WeekPoint[] = [];
  for (let wi = 0; wi < nWeeks; wi++) {
    // Série SUAVIZADA (janela de 3 semanas) — só para o gráfico, não p/ a regressão.
    let smooth: number | null = null;
    for (let j = Math.max(0, wi - 2); j <= wi; j++) {
      for (const p of preds[j]) if (smooth == null || p < smooth) smooth = p;
    }
    points.push({
      weekStartMs: nowWeekStart - (nWeeks - 1 - wi) * WEEK_MS,
      km: Math.round(km[wi] * 10) / 10,
      runs: runCount[wi],
      est5kSec: smooth != null ? Math.round(smooth) : null,
    });
  }

  // ── Regressão sobre os melhores-por-semana independentes ────────────────────
  const pts = rawBest
    .map((y, x) => ({ x, y }))
    .filter((p): p is { x: number; y: number } => p.y != null);

  let slope = 0;
  let r2 = 0;
  let trend: FitnessTrend['trend'] = 'insufficient';

  if (pts.length >= 4) {
    const n = pts.length;
    const mx = pts.reduce((a, p) => a + p.x, 0) / n;
    const my = pts.reduce((a, p) => a + p.y, 0) / n;
    let Sxx = 0, Sxy = 0, Syy = 0;
    for (const p of pts) {
      Sxx += (p.x - mx) ** 2;
      Sxy += (p.x - mx) * (p.y - my);
      Syy += (p.y - my) ** 2;
    }
    slope = Sxx > 0 ? Sxy / Sxx : 0;
    const sse = Math.max(0, Syy - (Sxx > 0 ? (Sxy * Sxy) / Sxx : 0));
    r2 = Syy > 0 ? 1 - sse / Syy : 1; // sem variância em y = ajuste "perfeito" (linha plana)
    const df = n - 2;
    const seSlope = df > 0 && Sxx > 0 ? Math.sqrt(sse / df / Sxx) : 0;
    // t de Student da inclinação. seSlope=0 com slope≠0 (ajuste perfeito) ⇒ ±∞ (significativo).
    const t = seSlope > 0 ? slope / seSlope : slope !== 0 ? Infinity : 0;
    // Corte por graus de liberdade (não 1.96 assintótico): amostra pequena exige
    // t MAIOR, senão declara tendência a partir de ruído.
    const significant = Math.abs(t) >= tCritical95(df);
    trend = significant && Math.abs(slope) > 1 ? (slope < 0 ? 'improving' : 'declining') : 'flat';
  }

  const allRaw = pts.map((p) => p.y);
  const best5kSec = allRaw.length ? Math.min(...allRaw) : null;
  const latest5kSec = [...points].reverse().find((p) => p.est5kSec != null)?.est5kSec ?? null;
  const totalKm = Math.round(points.reduce((a, p) => a + p.km, 0) * 10) / 10;

  return {
    weeks: points,
    trend,
    deltaSecPerWeek: Math.round(slope * 10) / 10,
    r2: Math.round(r2 * 100) / 100,
    best5kSec,
    latest5kSec,
    totalKm,
  };
}
