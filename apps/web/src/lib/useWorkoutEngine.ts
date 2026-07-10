'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Engine de treino intervalado — o coração do player.
 *
 * Diferenciais vs. um timer ingênuo (setInterval decrementando):
 *  - Cronometragem ancorada em wall-clock (Date.now): zero drift ao longo de
 *    treinos longos e resiliente ao throttling do browser quando a aba/tela
 *    vai pro fundo. Um setInterval(1000) que faz `r-1` perde segundos.
 *  - AudioContext único e compartilhado (beeps não ficam mudos após N usos).
 *  - Wake Lock: mantém a tela acesa durante o treino.
 *  - Vibração háptica nas transições e na contagem regressiva.
 *  - Cues de voz ricos: pré-aviso do próximo bloco, contagem 3-2-1, metade,
 *    última repetição e resumo final.
 */

export interface RawSegment {
  id: string;
  order: number;
  kind: string;
  durationSec?: number;
  distanceM?: number;
  repeats: number;
  notes?: string;
}

export interface Step {
  kind: string;
  durationSec: number;
  label: string;
  /** true quando é a última repetição de um grupo com repeats > 1 */
  isLastRep: boolean;
  /** distância alvo em metros, quando o segmento é por distância (só display) */
  distanceM?: number;
}

const KIND_LABEL: Record<string, string> = {
  WARMUP: 'Aquecimento',
  INTERVAL_FAST: 'Tiro forte',
  INTERVAL_SLOW: 'Recuperação',
  TEMPO: 'Tempo',
  EASY: 'Leve',
  COOLDOWN: 'Volta calma',
  REST: 'Descanso',
  CUSTOM: 'Bloco',
};

/** Pace default (seg/km) usado só para estimar duração de segmentos por distância. */
const DEFAULT_PACE_SEC_PER_KM = 330; // 5:30 min/km

function readDefaultPace(): number {
  try {
    const cached = localStorage.getItem('rq.settings');
    if (cached) {
      const s = JSON.parse(cached);
      if (typeof s.defaultPaceSecPerKm === 'number' && s.defaultPaceSecPerKm > 0) {
        return s.defaultPaceSecPerKm;
      }
    }
  } catch {}
  return DEFAULT_PACE_SEC_PER_KM;
}

/** Expande segmentos (com repeats) numa lista linear de passos cronometráveis. */
export function expandSegments(segs: RawSegment[]): Step[] {
  const pace = readDefaultPace();
  const out: Step[] = [];
  for (const s of segs) {
    const reps = Math.max(1, s.repeats || 1);
    // Duração: por tempo se houver, senão estimada a partir da distância e do pace.
    const durationSec =
      s.durationSec && s.durationSec > 0
        ? s.durationSec
        : s.distanceM && s.distanceM > 0
          ? Math.max(5, Math.round((s.distanceM / 1000) * pace))
          : 60;
    const base = KIND_LABEL[s.kind] ?? KIND_LABEL.CUSTOM;
    for (let r = 0; r < reps; r++) {
      out.push({
        kind: s.kind,
        durationSec,
        label: reps > 1 ? `${base} ${r + 1}/${reps}` : base,
        isLastRep: reps > 1 && r === reps - 1,
        distanceM: s.distanceM && s.distanceM > 0 ? s.distanceM : undefined,
      });
    }
  }
  return out;
}

// ── Áudio: um único AudioContext reaproveitado ───────────────────────────────
let sharedCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  try {
    if (!sharedCtx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      sharedCtx = new Ctx();
    }
    // Browsers suspendem o contexto sem gesto do usuário; retomar é barato.
    if (sharedCtx.state === 'suspended') void sharedCtx.resume();
    return sharedCtx;
  } catch {
    return null;
  }
}

export function beep(freq = 880, durMs = 180, vol = 0.35) {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    // envelope curto pra não estourar
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.01);
    gain.gain.linearRampToValueAtTime(0, now + durMs / 1000);
    osc.start(now);
    osc.stop(now + durMs / 1000 + 0.02);
  } catch {}
}

export function speak(text: string, { interrupt = true }: { interrupt?: boolean } = {}) {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR';
    u.rate = 1.05;
    u.pitch = 1;
    if (interrupt) window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {}
}

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
  } catch {}
}

function spokenSeconds(sec: number): string {
  if (sec < 60) return `${sec} segundos`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (s === 0) return m === 1 ? 'um minuto' : `${m} minutos`;
  return `${m} e ${s < 10 ? '0' : ''}${s}`;
}

export interface WorkoutEngine {
  steps: Step[];
  idx: number;
  remaining: number;
  running: boolean;
  done: boolean;
  cur: Step | undefined;
  next: Step | undefined;
  totalRemaining: number;
  progress: number; // 0..1 do passo atual
  toggle: () => void;
  skip: () => void;
  prev: () => void;
}

export function useWorkoutEngine(
  rawSegments: RawSegment[] | null,
  opts: { controlledRunning?: boolean } = {},
): WorkoutEngine {
  const controlled = opts.controlledRunning;
  const steps = useMemo(() => (rawSegments ? expandSegments(rawSegments) : []), [rawSegments]);

  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const remainingRef = useRef(0);
  remainingRef.current = remaining;

  // Âncora de wall-clock: (segundos restantes no instante da âncora, timestamp da âncora)
  const anchorRef = useRef<{ at: number; secs: number }>({ at: 0, secs: 0 });
  const rafRef = useRef<number | null>(null);
  const spokenSecRef = useRef<number>(-1); // último segundo falado nesta contagem
  const halfCuedRef = useRef<boolean>(false);
  const wakeRef = useRef<WakeLockSentinel | null>(null);
  const idxRef = useRef(0);
  const stepsRef = useRef<Step[]>(steps);

  idxRef.current = idx;
  stepsRef.current = steps;

  // Inicializa o restante quando os steps chegam.
  useEffect(() => {
    if (steps.length) {
      setIdx(0);
      setRemaining(steps[0].durationSec);
      setDone(false);
      setRunning(false);
    }
  }, [steps]);

  // Wake Lock: adquire quando rodando, libera quando pausa/desmonta.
  useEffect(() => {
    let released = false;
    async function acquire() {
      try {
        if (running && 'wakeLock' in navigator) {
          wakeRef.current = await navigator.wakeLock.request('screen');
        }
      } catch {}
    }
    async function release() {
      try {
        if (wakeRef.current) {
          await wakeRef.current.release();
          wakeRef.current = null;
        }
      } catch {}
    }
    if (running) void acquire();
    else void release();
    // reaquire ao voltar de background
    const onVis = () => {
      if (!released && running && document.visibilityState === 'visible') void acquire();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVis);
      void release();
    };
  }, [running]);

  // Modo controlado: quando embutido na corrida GPS, o engine segue o estado
  // de "tracking" do pai em vez do próprio botão play/pause.
  useEffect(() => {
    if (controlled === undefined) return;
    setRunning((prev) => {
      if (controlled === prev) return prev;
      if (controlled) {
        anchorRef.current = { at: Date.now(), secs: remainingRef.current };
        getCtx();
        if (idxRef.current === 0 && spokenSecRef.current === -1) {
          const s = stepsRef.current[0];
          if (s) speak(`Começando. ${s.label}. ${spokenSeconds(s.durationSec)}.`);
        }
      } else {
        window.speechSynthesis?.cancel();
      }
      return controlled;
    });
  }, [controlled]);

  const advance = useCallback((delta: number) => {
    const list = stepsRef.current;
    setIdx((i) => {
      const nx = i + delta;
      if (nx >= list.length) {
        setRunning(false);
        setDone(true);
        speak('Treino finalizado. Mandou muito bem!');
        vibrate([120, 60, 120, 60, 240]);
        return i;
      }
      if (nx < 0) return 0;
      const step = list[nx];
      setRemaining(step.durationSec);
      anchorRef.current = { at: Date.now(), secs: step.durationSec };
      spokenSecRef.current = -1;
      halfCuedRef.current = false;
      const dur = spokenSeconds(step.durationSec);
      const lead = step.isLastRep ? 'Última! ' : '';
      speak(`${lead}${step.label}. ${dur}.`);
      vibrate(step.kind === 'INTERVAL_FAST' ? [200, 80, 200] : 150);
      return nx;
    });
  }, []);

  // Loop de cronometragem via requestAnimationFrame + wall-clock.
  useEffect(() => {
    if (!running) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const loop = () => {
      const { at, secs } = anchorRef.current;
      const elapsed = (Date.now() - at) / 1000;
      const r = Math.max(0, Math.ceil(secs - elapsed));
      setRemaining(r);

      const step = stepsRef.current[idxRef.current];
      if (step) {
        // metade (só em blocos >= 60s)
        if (!halfCuedRef.current && step.durationSec >= 60 && r <= Math.floor(step.durationSec / 2) && r > 5) {
          halfCuedRef.current = true;
          speak('Metade.', { interrupt: false });
        }
        // contagem regressiva 3-2-1 (fala uma vez por segundo)
        if (r <= 3 && r >= 1 && spokenSecRef.current !== r) {
          spokenSecRef.current = r;
          beep(r === 1 ? 1180 : 760, 120, 0.3);
          vibrate(60);
        }
      }

      if (r <= 0) {
        beep(1320, 260, 0.4);
        advance(1);
      } else {
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running, advance]);

  const toggle = useCallback(() => {
    if (controlled !== undefined) return; // pai controla o play/pause
    setRunning((r) => {
      const nextRunning = !r;
      if (nextRunning) {
        // (re)ancora no restante atual — retomar não perde tempo
        anchorRef.current = { at: Date.now(), secs: remaining };
        getCtx(); // desbloqueia áudio no gesto do usuário
        if (idxRef.current === 0 && spokenSecRef.current === -1) {
          const s = stepsRef.current[0];
          if (s) speak(`Começando. ${s.label}. ${spokenSeconds(s.durationSec)}.`);
        }
        beep(880, 160);
        vibrate(80);
      } else {
        window.speechSynthesis?.cancel();
      }
      return nextRunning;
    });
  }, [remaining, controlled]);

  const skip = useCallback(() => advance(1), [advance]);
  const prev = useCallback(() => {
    // volta pro início do bloco atual se já passou >3s, senão pro anterior
    const elapsed = (Date.now() - anchorRef.current.at) / 1000;
    if (running && anchorRef.current.secs - elapsed < anchorRef.current.secs - 3) {
      const step = stepsRef.current[idxRef.current];
      if (step) {
        setRemaining(step.durationSec);
        anchorRef.current = { at: Date.now(), secs: step.durationSec };
        spokenSecRef.current = -1;
        halfCuedRef.current = false;
        return;
      }
    }
    advance(-1);
  }, [advance, running]);

  const cur = steps[idx];
  const next = steps[idx + 1];
  const totalRemaining = steps.slice(idx).reduce((a, s, i) => a + (i === 0 ? remaining : s.durationSec), 0);
  const progress = cur && cur.durationSec > 0 ? 1 - remaining / cur.durationSec : 0;

  return { steps, idx, remaining, running, done, cur, next, totalRemaining, progress, toggle, skip, prev };
}
