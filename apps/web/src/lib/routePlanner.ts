/**
 * PLANEJADOR DE ROTA — desenhe o percurso e veja a prévia (estilo Google).
 *
 * Waypoints [lat,lng] clicados no mapa viram distância total (haversine),
 * tempo estimado por pace e opção ida-e-volta. Persistência em localStorage.
 * Funções puras (exceto load/save, isolados) — testáveis.
 */

import { haversine } from './geo';

export type LatLng = [number, number];

export interface RouteStats {
  distanceM: number;
  estSec: number; // no pace informado
  points: number;
}

/** Distância acumulada de uma sequência de waypoints [lat,lng]. */
export function routeDistanceM(pts: LatLng[]): number {
  let d = 0;
  for (let i = 1; i < (pts?.length ?? 0); i++) d += haversine(pts[i - 1], pts[i]);
  return Math.round(d);
}

export function routeStats(pts: LatLng[], paceSecPerKm: number): RouteStats {
  const distanceM = routeDistanceM(pts);
  const pace = paceSecPerKm > 0 ? paceSecPerKm : 0;
  return {
    distanceM,
    estSec: pace > 0 ? Math.round((distanceM / 1000) * pace) : 0,
    points: pts?.length ?? 0,
  };
}

/** Ida-e-volta: espelha o caminho (sem duplicar o último ponto). */
export function outAndBack(pts: LatLng[]): LatLng[] {
  if (!pts || pts.length < 2) return pts ?? [];
  return [...pts, ...[...pts].reverse().slice(1)];
}

/** Fecha o circuito voltando ao ponto inicial (se ainda não fechado). */
export function closeLoop(pts: LatLng[]): LatLng[] {
  if (!pts || pts.length < 3) return pts ?? [];
  const [aLat, aLng] = pts[0];
  const [zLat, zLng] = pts[pts.length - 1];
  if (aLat === zLat && aLng === zLng) return pts;
  return [...pts, pts[0]];
}

// ── Persistência local ────────────────────────────────────────────────────────
export interface SavedRoute {
  id: string;
  name: string;
  points: LatLng[];
  distanceM: number;
  createdAt: string;
}

const LS_KEY = 'rq.routes';

export function loadRoutes(): SavedRoute[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveRoute(name: string, points: LatLng[]): SavedRoute {
  const route: SavedRoute = {
    id: `rt-${Date.now().toString(36)}`,
    name: name || 'Percurso',
    points,
    distanceM: routeDistanceM(points),
    createdAt: new Date().toISOString(),
  };
  const all = [route, ...loadRoutes()].slice(0, 50);
  try { localStorage.setItem(LS_KEY, JSON.stringify(all)); } catch {}
  return route;
}

export function deleteRoute(id: string): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(loadRoutes().filter((r) => r.id !== id))); } catch {}
}
