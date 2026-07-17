/**
 * Leitura segura de coordenadas vindas de uma coluna Json (GeoJSON LineString).
 * Antes era `(x as any)?.coordinates as number[][]` em 2 lugares: além de mentir
 * pro compilador, confiava que o Json sempre tem o shape certo. O export de GPX
 * fazia `coords.map(([lng, lat]) => lat.toFixed(6))` — um ponto malformado no
 * banco (dado legado/corrompido) virava 500. Aqui pontos inválidos são filtrados.
 */

/** Pares `[lng, lat]` numéricos e finitos de um GeoJSON; `[]` se nada bater. */
export function geoJsonCoords(value: unknown): number[][] {
  const coords = (value as { coordinates?: unknown } | null | undefined)?.coordinates;
  if (!Array.isArray(coords)) return [];
  return coords.filter(
    (p): p is number[] =>
      Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]),
  );
}
