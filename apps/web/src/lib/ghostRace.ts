/**
 * FANTASMA / PARCEIRO VIRTUAL — corra ao vivo contra o seu melhor eu.
 *
 * Dado o tempo decorrido e a distância real, projeta onde um "fantasma" que
 * corre a um pace-alvo constante estaria AGORA, e calcula a vantagem/atraso em
 * metros e segundos. É o Virtual Partner do Garmin — mas contra o SEU recorde.
 * Nem Strava nem INTVL fazem isso ao vivo.
 *
 * Funções puras — sem rede, sem estado.
 */

export interface GhostState {
  ghostMeters: number; // onde o fantasma está agora
  youMeters: number; // onde você está
  gapMeters: number; // + = você na frente
  gapSec: number; // vantagem/atraso convertido em segundos (no pace do fantasma)
  ahead: boolean; // você está na frente?
  finished: boolean; // alguém cruzou a distância-alvo?
  youFinished: boolean;
  ghostFinished: boolean;
  progress: number; // 0..1 rumo à distância-alvo (pela sua posição), 0 se sem alvo
}

export interface GhostOpts {
  elapsedSec: number;
  youMeters: number;
  ghostPaceSecPerKm: number; // pace do fantasma (s/km)
  targetDistanceM?: number; // opcional: linha de chegada
}

export function ghostProgress(o: GhostOpts): GhostState {
  const pace = o.ghostPaceSecPerKm > 0 ? o.ghostPaceSecPerKm : 0;
  const you = Math.max(0, o.youMeters || 0);
  const elapsed = Math.max(0, o.elapsedSec || 0);
  const ghostMeters = pace > 0 ? (elapsed / pace) * 1000 : 0;
  const gapMeters = you - ghostMeters;
  const gapSec = pace > 0 ? (gapMeters * pace) / 1000 : 0;

  const target = o.targetDistanceM && o.targetDistanceM > 0 ? o.targetDistanceM : 0;
  const youFinished = target > 0 && you >= target;
  const ghostFinished = target > 0 && ghostMeters >= target;

  return {
    ghostMeters: Math.round(ghostMeters),
    youMeters: Math.round(you),
    gapMeters: Math.round(gapMeters),
    gapSec: Math.round(gapSec),
    ahead: gapMeters >= 0,
    finished: youFinished || ghostFinished,
    youFinished,
    ghostFinished,
    progress: target > 0 ? Math.min(1, you / target) : 0,
  };
}

/**
 * Decide se deve anunciar uma mudança de liderança (ultrapassou / foi
 * ultrapassado), com histerese em metros para não ficar tagarelando no limite.
 * Retorna a frase (ou null). `prevAhead` = estado anterior (null no início).
 */
export function leadChangeCallout(
  prevAhead: boolean | null,
  state: GhostState,
  hysteresisM = 8,
): string | null {
  if (Math.abs(state.gapMeters) < hysteresisM) return null; // zona morta perto do empate
  if (prevAhead === null) return null;
  if (state.ahead && !prevAhead) return `Ultrapassou! ${Math.abs(state.gapMeters)} metros na frente.`;
  if (!state.ahead && prevAhead) return `Fantasma passou. ${Math.abs(state.gapMeters)} metros atrás — reage!`;
  return null;
}

/** Frase de resultado quando cruza a linha de chegada. */
export function finishCallout(state: GhostState): string {
  if (state.youFinished && (!state.ghostFinished || state.gapMeters >= 0))
    return `Você venceu o fantasma por ${Math.abs(state.gapSec)} segundos! 🏆`;
  return `O fantasma chegou primeiro por ${Math.abs(state.gapSec)} segundos. Revanche?`;
}
