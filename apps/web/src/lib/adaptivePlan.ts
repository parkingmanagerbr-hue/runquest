/**
 * Motor de PLANO ADAPTATIVO — o segundo pilar do INTVL.
 *
 * (1) Avalia a carga de treino real (ACWR = agudo/crônico) para segurança.
 * (2) Gera a semana de treino ajustada à FORMA atual (paces de treinamento) e
 *     à carga: progride ~8%/semana no ponto ideal, segura quando o risco sobe,
 *     e faz deload a cada 4ª semana. Cada sessão vira segmentos compatíveis com
 *     o player (useWorkoutEngine) e com o POST /workouts.
 *
 * Funções puras — sem rede.
 */

import type { RawSegment } from './useWorkoutEngine';
import type { RunLite, TrainingPaces, PaceZone } from './trainingPaces';

export type Goal = '5k' | '10k' | 'half' | 'marathon' | 'fitness';

export interface LoadSummary {
  acute7Km: number; // km nos últimos 7 dias
  chronicWeeklyKm: number; // média semanal nas últimas 4 semanas
  acwr: number; // agudo / crônico
  status: 'low' | 'ok' | 'high' | 'none';
  runsLast7: number;
}

export type SessionKind = 'easy' | 'long' | 'intervals' | 'tempo' | 'recovery' | 'rest';

export interface PlanSession {
  day: number; // 0..6 dentro da semana
  kind: SessionKind;
  title: string;
  description: string;
  segments: RawSegment[];
  focusPaceSecPerKm?: number;
  estDistanceM: number;
  estDurationSec: number;
}

export interface AdaptivePlanWeek {
  weekIndex: number; // 0-based
  targetKm: number;
  deload: boolean;
  acwrGated: boolean; // progressão travada por risco de lesão
  sessions: PlanSession[];
  note: string;
}

const DAY_MS = 86400000;

/** ACWR: carga aguda (7d) vs crônica (média semanal de 28d). */
export function assessLoad(runs: RunLite[], now: number): LoadSummary {
  let acute = 0;
  let last28 = 0;
  let runsLast7 = 0;
  for (const r of runs) {
    const t = Date.parse(r.startedAt);
    if (isNaN(t) || !(r.distanceMeters > 0)) continue;
    const ageDays = (now - t) / DAY_MS;
    if (ageDays < 0) continue;
    if (ageDays <= 7) { acute += r.distanceMeters / 1000; runsLast7++; }
    if (ageDays <= 28) last28 += r.distanceMeters / 1000;
  }
  const chronicWeekly = last28 / 4;
  const acwr = chronicWeekly > 0.5 ? acute / chronicWeekly : 0;
  let status: LoadSummary['status'] = 'none';
  if (chronicWeekly < 0.5) status = 'none';
  else if (acwr < 0.8) status = 'low';
  else if (acwr <= 1.3) status = 'ok';
  else status = 'high';
  return {
    acute7Km: Math.round(acute * 10) / 10,
    chronicWeeklyKm: Math.round(chronicWeekly * 10) / 10,
    acwr: Math.round(acwr * 100) / 100,
    status,
    runsLast7,
  };
}

/** Volume-base semanal recomendado: usa o crônico real, com pisos por objetivo. */
export function baseWeeklyKm(load: LoadSummary, goal: Goal): number {
  const floor: Record<Goal, number> = { fitness: 10, '5k': 15, '10k': 20, half: 30, marathon: 40 };
  const fromLoad = load.chronicWeeklyKm > 1 ? load.chronicWeeklyKm : 0;
  // se ainda não há histórico, começa conservador (60% do piso do objetivo)
  return Math.max(fromLoad, fromLoad > 0 ? floor[goal] * 0.5 : floor[goal] * 0.6);
}

function mkSeg(i: number, kind: string, opts: { durationSec?: number; distanceM?: number; repeats?: number; notes?: string }): RawSegment {
  return { id: `s${i}`, order: i, kind, repeats: opts.repeats ?? 1, durationSec: opts.durationSec, distanceM: opts.distanceM, notes: opts.notes };
}

function paceNote(paces: TrainingPaces, zone: PaceZone): string {
  const p = paces.paces[zone];
  return `${Math.floor(p / 60)}:${String(p % 60).padStart(2, '0')}/km`;
}

function durForKm(km: number, paceSecPerKm: number): number {
  return Math.round(km * paceSecPerKm);
}

/** Uma corrida contínua (fácil/longo/recuperação) como sessão. */
function steadySession(day: number, kind: SessionKind, km: number, zone: PaceZone, paces: TrainingPaces, title: string): PlanSession {
  const pace = paces.paces[zone];
  const dur = durForKm(km, pace);
  return {
    day, kind, title,
    description: `${km.toFixed(1)} km em ritmo ${title.toLowerCase()} (${paceNote(paces, zone)})`,
    segments: [mkSeg(0, kind === 'long' ? 'EASY' : kind === 'recovery' ? 'REST' : 'EASY', { distanceM: Math.round(km * 1000), durationSec: dur, notes: paceNote(paces, zone) })],
    focusPaceSecPerKm: pace,
    estDistanceM: Math.round(km * 1000),
    estDurationSec: dur,
  };
}

/** Sessão de intervalado (VO2): aquecimento + N×(tiro + recuperação) + volta calma. */
function intervalSession(day: number, reps: number, repMeters: number, paces: TrainingPaces): PlanSession {
  const segs: RawSegment[] = [];
  let i = 0;
  const warmSec = 600;
  segs.push(mkSeg(i++, 'WARMUP', { durationSec: warmSec, notes: paceNote(paces, 'easy') }));
  const repSec = Math.max(30, durForKm(repMeters / 1000, paces.paces.interval));
  const recSec = Math.round(repSec * 0.9);
  for (let r = 0; r < reps; r++) {
    segs.push(mkSeg(i++, 'INTERVAL_FAST', { durationSec: repSec, distanceM: repMeters, notes: paceNote(paces, 'interval') }));
    segs.push(mkSeg(i++, 'INTERVAL_SLOW', { durationSec: recSec, notes: paceNote(paces, 'recovery') }));
  }
  const coolSec = 300;
  segs.push(mkSeg(i++, 'COOLDOWN', { durationSec: coolSec, notes: paceNote(paces, 'easy') }));
  const workDist = reps * repMeters;
  const estDistanceM = workDist + Math.round(((warmSec + coolSec) / paces.paces.easy) * 1000);
  const estDurationSec = warmSec + coolSec + reps * (repSec + recSec);
  return {
    day, kind: 'intervals',
    title: `Intervalado ${reps}×${repMeters}m`,
    description: `${reps} tiros de ${repMeters}m no ritmo de intervalado (${paceNote(paces, 'interval')}), com recuperação. Aquece e faz volta calma.`,
    segments: segs, focusPaceSecPerKm: paces.paces.interval, estDistanceM, estDurationSec,
  };
}

/** Sessão de tempo (limiar): aquecimento + bloco contínuo no limiar + volta calma. */
function tempoSession(day: number, tempoMin: number, paces: TrainingPaces): PlanSession {
  const warmSec = 600, coolSec = 300, tempoSec = tempoMin * 60;
  const segs: RawSegment[] = [
    mkSeg(0, 'WARMUP', { durationSec: warmSec, notes: paceNote(paces, 'easy') }),
    mkSeg(1, 'TEMPO', { durationSec: tempoSec, notes: paceNote(paces, 'threshold') }),
    mkSeg(2, 'COOLDOWN', { durationSec: coolSec, notes: paceNote(paces, 'easy') }),
  ];
  const tempoDist = (tempoSec / paces.paces.threshold) * 1000;
  const estDistanceM = Math.round(tempoDist + ((warmSec + coolSec) / paces.paces.easy) * 1000);
  return {
    day, kind: 'tempo',
    title: `Tempo run ${tempoMin} min`,
    description: `${tempoMin} min contínuos no ritmo de limiar (${paceNote(paces, 'threshold')}), entre aquecimento e volta calma.`,
    segments: segs, focusPaceSecPerKm: paces.paces.threshold, estDistanceM, estDurationSec: warmSec + coolSec + tempoSec,
  };
}

export interface BuildWeekOpts {
  goal: Goal;
  daysPerWeek: number; // 2..6
  weekIndex: number; // 0-based
  base: number; // km-base semanal (de baseWeeklyKm)
}

/**
 * Gera a semana adaptada. Progride ~8%/semana; deload (−30%) a cada 4ª semana;
 * trava a progressão se a carga aguda estiver alta (ACWR > 1.3).
 */
export function buildWeek(paces: TrainingPaces, load: LoadSummary, opts: BuildWeekOpts): AdaptivePlanWeek {
  const days = Math.max(2, Math.min(6, opts.daysPerWeek));
  const deload = opts.weekIndex > 0 && (opts.weekIndex + 1) % 4 === 0;
  const acwrGated = load.status === 'high';

  let targetKm = opts.base * Math.pow(1.08, opts.weekIndex);
  if (acwrGated) targetKm = Math.min(targetKm, opts.base); // não progride sob risco
  if (deload) targetKm *= 0.7;
  targetKm = Math.round(targetKm * 10) / 10;

  // Distribuição: 1 longo + trabalho de qualidade + resto fácil.
  const longKm = Math.max(4, Math.round(targetKm * (opts.goal === 'marathon' ? 0.34 : opts.goal === 'half' ? 0.3 : 0.28) * 10) / 10);
  const qualityCount = days >= 5 ? 2 : days >= 3 ? 1 : 0;
  const easyCount = days - 1 - qualityCount; // -1 do longo
  const remainingKm = Math.max(0, targetKm - longKm);
  const easyKm = easyCount > 0 ? Math.round((remainingKm * 0.6) / easyCount * 10) / 10 : 0;

  const sessions: PlanSession[] = [];
  let day = 0;
  const nextDay = () => { const d = day; day = Math.min(6, day + Math.max(1, Math.round(7 / days))); return d; };

  // Sessão(ões) de qualidade (alterna intervalado/tempo por semana)
  if (qualityCount >= 1) {
    if (opts.weekIndex % 2 === 0 || deload) {
      const reps = deload ? 4 : Math.min(8, 4 + Math.floor(opts.weekIndex / 2));
      sessions.push(intervalSession(nextDay(), reps, opts.goal === '5k' ? 400 : 800, paces));
    } else {
      const tmin = deload ? 15 : Math.min(35, 18 + opts.weekIndex * 2);
      sessions.push(tempoSession(nextDay(), tmin, paces));
    }
  }
  if (qualityCount >= 2) {
    const tmin = deload ? 15 : Math.min(30, 15 + opts.weekIndex);
    sessions.push(tempoSession(nextDay(), tmin, paces));
  }
  // Corridas fáceis
  for (let e = 0; e < easyCount; e++) {
    sessions.push(steadySession(nextDay(), 'easy', Math.max(3, easyKm), 'easy', paces, 'Fácil'));
  }
  // Longo (sempre a última do bloco)
  sessions.push(steadySession(6, 'long', longKm, 'easy', paces, 'Longo'));

  sessions.sort((a, b) => a.day - b.day);

  let note: string;
  if (acwrGated) note = 'Carga aguda alta — semana sem progressão para reduzir risco de lesão.';
  else if (deload) note = 'Semana de deload (−30%) para absorver o treino e recuperar.';
  else if (load.status === 'low' && load.chronicWeeklyKm > 1) note = 'Você está com folga de carga — progressão normal.';
  else note = `Progressão de ~8% sobre sua base (${opts.base.toFixed(0)} km/sem).`;

  return { weekIndex: opts.weekIndex, targetKm, deload, acwrGated, sessions, note };
}

export interface ScheduledEntry {
  date: string; // YYYY-MM-DD
  label: string;
  distanceM?: number;
  durationSec?: number;
  completed: boolean;
}

/**
 * Gera N semanas de sessões DATADAS para persistir como plano (POST /plans →
 * aparece no /calendar). Distribui as sessões da semana em dias distintos,
 * espalhados de forma uniforme (não usa o day interno, que pode colidir).
 */
export function buildSchedule(
  paces: TrainingPaces,
  load: LoadSummary,
  opts: { goal: Goal; daysPerWeek: number; base: number; weeks: number; startDate: Date },
): ScheduledEntry[] {
  const out: ScheduledEntry[] = [];
  for (let wi = 0; wi < opts.weeks; wi++) {
    const w = buildWeek(paces, load, { goal: opts.goal, daysPerWeek: opts.daysPerWeek, weekIndex: wi, base: opts.base });
    const n = w.sessions.length;
    w.sessions.forEach((s, i) => {
      const dayOffset = n > 1 ? Math.round((i * 6) / (n - 1)) : 3; // 0..6 distintos
      const d = new Date(opts.startDate);
      d.setDate(d.getDate() + wi * 7 + dayOffset);
      out.push({
        date: d.toISOString().slice(0, 10),
        label: `${SESSION_ICON[s.kind]} ${s.title}`,
        distanceM: s.estDistanceM,
        durationSec: s.estDurationSec,
        completed: false,
      });
    });
  }
  return out;
}

/** Converte uma sessão em corpo do POST /workouts. */
export function sessionToWorkoutBody(s: PlanSession) {
  return {
    name: s.title,
    type: s.kind === 'intervals' ? 'INTERVAL' : s.kind === 'tempo' ? 'TEMPO' : 'EASY',
    description: s.description,
    segments: s.segments,
    isTemplate: false,
  };
}

export const GOAL_LABEL: Record<Goal, string> = {
  '5k': '5K', '10k': '10K', half: 'Meia (21K)', marathon: 'Maratona (42K)', fitness: 'Condicionamento',
};

export const SESSION_ICON: Record<SessionKind, string> = {
  easy: '🟢', long: '🔵', intervals: '🔴', tempo: '🟣', recovery: '⚪', rest: '⏸️',
};
