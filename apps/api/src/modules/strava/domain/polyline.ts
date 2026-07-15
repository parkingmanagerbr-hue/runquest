/**
 * Decodificação de polyline codificada do Google (algoritmo público) → coords.
 * PURA e sem estado — extraída do webhook handler para golden-test contra a
 * referência canônica do Google.
 */

/** Decodifica uma polyline do Google em pares `[lng, lat]` (ordem GeoJSON). */
export function decodePolyline(str: string): number[][] {
  const coords: number[][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < str.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coords.push([lng / 1e5, lat / 1e5]);
  }
  return coords;
}
