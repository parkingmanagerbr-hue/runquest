/**
 * Persistência da corrida em andamento.
 *
 * Salva o estado do tracking no localStorage de forma incremental para que,
 * se o navegador matar a aba, o usuário recarregar sem querer ou o telefone
 * reiniciar, a corrida possa ser recuperada em vez de perdida.
 *
 * Web Geolocation NÃO roda em background (a aba pausa com a tela apagada),
 * então recuperação de estado é a defesa mais importante no PWA. Para tracking
 * contínuo em background de verdade, é necessário Capacitor + plugin nativo.
 */

export type Pt = [number, number]; // [lat, lng]

export interface ActiveRun {
  startedAt: string; // ISO
  points: Pt[];
  distance: number; // metros
  duration: number; // segundos
  elevGain: number;
  elevLoss: number;
  targetPace: number; // sec/km, 0 = sem alvo
  savedAt: number; // epoch ms
}

const KEY = 'rq.activeRun';

/** Idade máxima para considerar uma corrida recuperável (6h). */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

/** Distância mínima (m) para valer a pena oferecer recuperação. */
const MIN_DISTANCE_M = 50;

export function saveActiveRun(run: Omit<ActiveRun, 'savedAt'>): void {
  try {
    const payload: ActiveRun = { ...run, savedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // localStorage cheio ou indisponível — falha silenciosa, não derruba a corrida
  }
}

export function loadActiveRun(): ActiveRun | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const run = JSON.parse(raw) as ActiveRun;
    if (
      !run ||
      !Array.isArray(run.points) ||
      run.points.length < 2 ||
      typeof run.distance !== 'number' ||
      run.distance < MIN_DISTANCE_M ||
      typeof run.savedAt !== 'number' ||
      Date.now() - run.savedAt > MAX_AGE_MS
    ) {
      clearActiveRun();
      return null;
    }
    return run;
  } catch {
    return null;
  }
}

export function clearActiveRun(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
