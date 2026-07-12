/**
 * BIBLIOTECA DE TREINOS CLÁSSICOS — auto-personalizada aos SEUS paces.
 *
 * Gera as sessões que todo corredor conhece (Yasso 800s, fartlek, pirâmide,
 * tempo, VO2 400s, progressivo, longão) já calibradas nas suas zonas de treino
 * (de trainingPaces). Cada template vira RawSegment[] compatível com o player
 * (useWorkoutEngine) e com o POST /workouts. Funções puras — testáveis.
 */

import type { RawSegment } from './useWorkoutEngine';
import type { TrainingPaces, PaceZone } from './trainingPaces';

export interface WorkoutTemplate {
  id: string;
  name: string;
  emoji: string;
  type: string; // INTERVAL | TEMPO | FARTLEK | EASY | LONG_RUN | PROGRESSION
  description: string;
  focusZone: PaceZone;
  segments: RawSegment[];
  estDurationSec: number;
  estDistanceM: number;
}

const paceOf = (p: TrainingPaces, z: PaceZone) => p.paces[z];
const paceNote = (p: TrainingPaces, z: PaceZone) => {
  const s = p.paces[z];
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}/km`;
};
const durForDist = (distM: number, paceSecPerKm: number) => Math.max(5, Math.round((distM / 1000) * paceSecPerKm));

/** Acumulador que monta os segmentos e soma tempo/distância estimados. */
function make(paces: TrainingPaces) {
  const segs: RawSegment[] = [];
  let dur = 0;
  let dist = 0;
  const push = (kind: string, opts: { durationSec?: number; distanceM?: number; notes?: string }) => {
    segs.push({ id: `s${segs.length}`, order: segs.length, kind, repeats: 1, ...opts });
  };
  return {
    /** Bloco por tempo (aquecimento, tempo run, recuperação por tempo…). */
    time(kind: string, sec: number, zone: PaceZone) {
      push(kind, { durationSec: sec, notes: paceNote(paces, zone) });
      dur += sec;
      dist += Math.round((sec / paceOf(paces, zone)) * 1000);
      return this;
    },
    /** Bloco por distância (tiro de 400/800/1000m…) — grava distância E tempo estimado. */
    dist(kind: string, m: number, zone: PaceZone) {
      const sec = durForDist(m, paceOf(paces, zone));
      push(kind, { distanceM: m, durationSec: sec, notes: paceNote(paces, zone) });
      dur += sec;
      dist += m;
      return this;
    },
    done(): { segments: RawSegment[]; estDurationSec: number; estDistanceM: number } {
      return { segments: segs, estDurationSec: dur, estDistanceM: dist };
    },
  };
}

const WARM = 600; // 10 min
const COOL = 300; // 5 min

export function buildTemplates(paces: TrainingPaces): WorkoutTemplate[] {
  const out: WorkoutTemplate[] = [];

  // 1) Yasso 800s — 8×800m no intervalado, recuperação de tempo igual ao tiro
  {
    const b = make(paces);
    b.time('WARMUP', WARM, 'easy');
    const rec = durForDist(800, paceOf(paces, 'interval'));
    for (let i = 0; i < 8; i++) { b.dist('INTERVAL_FAST', 800, 'interval'); b.time('INTERVAL_SLOW', rec, 'recovery'); }
    b.time('COOLDOWN', COOL, 'easy');
    const d = b.done();
    out.push({ id: 'yasso-800', name: 'Yasso 800s', emoji: '🏔️', type: 'INTERVAL', focusZone: 'interval',
      description: `8×800m no ritmo de intervalado (${paceNote(paces, 'interval')}), com trote de recuperação. Clássico da maratona.`, ...d });
  }

  // 2) 5×1000m no limiar
  {
    const b = make(paces);
    b.time('WARMUP', WARM, 'easy');
    for (let i = 0; i < 5; i++) { b.dist('INTERVAL_FAST', 1000, 'threshold'); b.time('INTERVAL_SLOW', 90, 'recovery'); }
    b.time('COOLDOWN', COOL, 'easy');
    const d = b.done();
    out.push({ id: '1k-repeats', name: '5×1000m', emoji: '🎯', type: 'INTERVAL', focusZone: 'threshold',
      description: `5 tiros de 1 km no limiar (${paceNote(paces, 'threshold')}), 90s de recuperação. Base de resistência de ritmo.`, ...d });
  }

  // 3) VO2 400s — 12×400m na repetição
  {
    const b = make(paces);
    b.time('WARMUP', WARM, 'easy');
    for (let i = 0; i < 12; i++) { b.dist('INTERVAL_FAST', 400, 'repetition'); b.time('INTERVAL_SLOW', 60, 'recovery'); }
    b.time('COOLDOWN', COOL, 'easy');
    const d = b.done();
    out.push({ id: 'vo2-400', name: 'VO₂ 400s', emoji: '⚡', type: 'INTERVAL', focusZone: 'repetition',
      description: `12×400m rápidos (${paceNote(paces, 'repetition')}), 60s de recuperação. Potência aeróbica e economia.`, ...d });
  }

  // 4) Fartlek 10×(1min forte / 1min leve)
  {
    const b = make(paces);
    b.time('WARMUP', WARM, 'easy');
    for (let i = 0; i < 10; i++) { b.time('INTERVAL_FAST', 60, 'interval'); b.time('INTERVAL_SLOW', 60, 'easy'); }
    b.time('COOLDOWN', COOL, 'easy');
    const d = b.done();
    out.push({ id: 'fartlek', name: 'Fartlek 10×1′', emoji: '🎲', type: 'FARTLEK', focusZone: 'interval',
      description: `10 × (1 min forte ${paceNote(paces, 'interval')} / 1 min leve). Jogo de ritmo, divertido e eficiente.`, ...d });
  }

  // 5) Pirâmide 200-400-600-800-600-400-200 no intervalado
  {
    const b = make(paces);
    b.time('WARMUP', WARM, 'easy');
    const ladder = [200, 400, 600, 800, 600, 400, 200];
    ladder.forEach((m, i) => { b.dist('INTERVAL_FAST', m, 'interval'); if (i < ladder.length - 1) b.time('INTERVAL_SLOW', 90, 'recovery'); });
    b.time('COOLDOWN', COOL, 'easy');
    const d = b.done();
    out.push({ id: 'pyramid', name: 'Pirâmide', emoji: '🔺', type: 'INTERVAL', focusZone: 'interval',
      description: `200→400→600→800→600→400→200 m no intervalado (${paceNote(paces, 'interval')}). Sobe e desce a escada.`, ...d });
  }

  // 6) Tempo run — 25 min contínuos no limiar
  {
    const b = make(paces);
    b.time('WARMUP', WARM, 'easy');
    b.time('TEMPO', 25 * 60, 'threshold');
    b.time('COOLDOWN', COOL, 'easy');
    const d = b.done();
    out.push({ id: 'tempo', name: 'Tempo Run', emoji: '🚀', type: 'TEMPO', focusZone: 'threshold',
      description: `25 min contínuos no limiar (${paceNote(paces, 'threshold')}). Eleva seu ritmo sustentável.`, ...d });
  }

  // 7) Progressivo — leve → maratona → limiar
  {
    const b = make(paces);
    b.time('WARMUP', WARM, 'easy');
    b.time('EASY', 10 * 60, 'easy');
    b.time('TEMPO', 10 * 60, 'marathon');
    b.time('TEMPO', 8 * 60, 'threshold');
    b.time('COOLDOWN', 3 * 60, 'easy');
    const d = b.done();
    out.push({ id: 'progression', name: 'Progressivo', emoji: '📈', type: 'PROGRESSION', focusZone: 'marathon',
      description: `Acelera aos poucos: leve → maratona (${paceNote(paces, 'marathon')}) → limiar. Termina forte.`, ...d });
  }

  // 8) Longão — 60 min fácil (único bloco contínuo)
  {
    const b = make(paces);
    b.time('EASY', 60 * 60, 'easy');
    const d = b.done();
    out.push({ id: 'long-run', name: 'Longão', emoji: '🛣️', type: 'LONG_RUN', focusZone: 'easy',
      description: `60 min em ritmo fácil (${paceNote(paces, 'easy')}). Base aeróbica — a corrida mais importante da semana.`, ...d });
  }

  return out;
}

/** Corpo do POST /workouts a partir de um template. */
export function templateToWorkoutBody(t: WorkoutTemplate) {
  return {
    name: t.name,
    type: t.type,
    description: t.description,
    segments: t.segments,
    isTemplate: false,
  };
}
