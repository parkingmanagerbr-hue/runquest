/**
 * Geração do CSV de histórico de corridas — PURA e testável. Antes vivia inline
 * no componente e produzia "NaN" quando um campo faltava e "NaN:NaN" de pace para
 * corridas sem GPS (avgPaceSecPerKm 0/indefinido). Aqui todo campo numérico é
 * guardado e os textos são escapados corretamente (aspas duplicadas).
 */

export interface CsvRun {
  startedAt: string;
  distanceMeters: number;
  durationSec: number;
  avgPaceSecPerKm: number;
  source: string;
}

export const CSV_HEADER = 'Data,Distância (km),Duração (min),Pace médio (min/km),Fonte';

function csvQuote(s: string): string {
  return `"${String(s ?? '').replace(/"/g, '""')}"`;
}

/** Pace "m:ss" — vazio quando não há pace real (corrida sem GPS). */
function paceStr(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '';
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/** Uma linha do CSV para uma corrida. */
export function runToCsvRow(r: CsvRun): string {
  const t = Date.parse(r.startedAt);
  const d = Number.isFinite(t) ? new Date(t).toISOString().slice(0, 19).replace('T', ' ') : '';
  const km = Number.isFinite(r.distanceMeters) ? (r.distanceMeters / 1000).toFixed(2) : '0.00';
  const min = Number.isFinite(r.durationSec) ? (r.durationSec / 60).toFixed(1) : '0.0';
  return `${csvQuote(d)},${km},${min},${csvQuote(paceStr(r.avgPaceSecPerKm))},${csvQuote(r.source)}`;
}

/** CSV completo (cabeçalho + linhas) do histórico. */
export function runsToCsv(runs: CsvRun[]): string {
  return [CSV_HEADER, ...runs.map(runToCsvRow)].join('\n');
}
