/**
 * CARD COMPARTILHÁVEL DA CORRIDA — a "figurinha" que dá orgulho de postar.
 *
 * Projeta o traçado real do GPS (GeoJSON [lng,lat]) num SVG com a marca do
 * RunQuest e as stats principais. Geometria e SVG são puros (sem DOM/rede) —
 * a conversão p/ PNG fica no cliente. Testável ao osso.
 */

export interface RunCardData {
  coordinates: number[][]; // [lng, lat][]
  distanceMeters: number;
  durationSec: number;
  avgPaceSecPerKm: number;
  dateLabel: string;
  elevationGainM?: number | null;
  title?: string;
}

/**
 * Projeta as coordenadas ([lng,lat]) num path SVG cabendo em (w×h) com padding,
 * preservando a forma (corrige a compressão de longitude pela latitude média) e
 * invertendo Y (tela cresce p/ baixo). Retorna '' se < 2 pontos.
 */
export function routeToPath(coords: number[][], w: number, h: number, pad: number): string {
  const pts = (coords || []).filter((c) => Array.isArray(c) && c.length >= 2 && isFinite(c[0]) && isFinite(c[1]));
  if (pts.length < 2) return '';

  const midLat = pts.reduce((a, c) => a + c[1], 0) / pts.length;
  const kx = Math.cos((midLat * Math.PI) / 180) || 1e-6;
  const proj = pts.map((c) => [c[0] * kx, c[1]] as [number, number]);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of proj) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const spanX = maxX - minX || 1e-9;
  const spanY = maxY - minY || 1e-9;
  const availW = w - 2 * pad;
  const availH = h - 2 * pad;
  const scale = Math.min(availW / spanX, availH / spanY);
  const drawW = spanX * scale;
  const drawH = spanY * scale;
  const offX = pad + (availW - drawW) / 2;
  const offY = pad + (availH - drawH) / 2;

  const map = ([x, y]: [number, number]): [number, number] => [
    offX + (x - minX) * scale,
    // inverte Y: latitude maior = mais acima na tela
    offY + (maxY - y) * scale,
  ];

  return proj
    .map((p, i) => {
      const [X, Y] = map(p);
      return `${i === 0 ? 'M' : 'L'}${X.toFixed(1)},${Y.toFixed(1)}`;
    })
    .join(' ');
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function fmtPace(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return '--:--';
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
}
function fmtDur(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/** SVG completo do card (1080×1350, estética aurora do RunQuest). */
export function buildRunCardSvg(d: RunCardData): string {
  const W = 1080, H = 1350;
  const path = routeToPath(d.coordinates, W, 760, 120); // área do mapa no topo
  const km = (d.distanceMeters / 1000).toFixed(2);
  const hasElev = (d.elevationGainM ?? 0) > 1;
  const title = esc(d.title || 'RunQuest');

  const stat = (x: number, big: string, small: string) => `
    <text x="${x}" y="1120" font-family="Arial, sans-serif" font-size="76" font-weight="900" fill="#ffffff" text-anchor="middle">${esc(big)}</text>
    <text x="${x}" y="1170" font-family="Arial, sans-serif" font-size="30" fill="#a8ffce" text-anchor="middle" letter-spacing="2">${esc(small)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0E0A2A"/>
      <stop offset="0.55" stop-color="#1A1240"/>
      <stop offset="1" stop-color="#0E0A2A"/>
    </linearGradient>
    <radialGradient id="blob" cx="0.2" cy="0.15" r="0.6">
      <stop offset="0" stop-color="#A8FF3E" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#A8FF3E" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="route" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#A8FF3E"/>
      <stop offset="1" stop-color="#3DD68C"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#blob)"/>
  <text x="60" y="90" font-family="Arial, sans-serif" font-size="40" font-weight="900" fill="#A8FF3E">RunQuest</text>
  <text x="${W - 60}" y="90" font-family="Arial, sans-serif" font-size="28" fill="#ffffff" fill-opacity="0.6" text-anchor="end">${esc(d.dateLabel)}</text>
  ${path
      ? `<path d="${path}" fill="none" stroke="url(#route)" stroke-width="10" stroke-linejoin="round" stroke-linecap="round"/>
         <circle r="14" fill="#A8FF3E" cx="${path.slice(1).split(' ')[0].split(',')[0]}" cy="${path.slice(1).split(' ')[0].split(',')[1]}"/>`
      : `<text x="${W / 2}" y="440" font-family="Arial, sans-serif" font-size="34" fill="#ffffff" fill-opacity="0.35" text-anchor="middle">sem traçado GPS</text>`}
  <text x="60" y="960" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="#ffffff">${title}</text>
  <line x1="60" y1="1000" x2="${W - 60}" y2="1000" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2"/>
  ${stat(W * 0.2, km, 'KM')}
  ${stat(W * 0.5, fmtDur(d.durationSec), 'TEMPO')}
  ${stat(W * 0.8, fmtPace(d.avgPaceSecPerKm), 'PACE /KM')}
  ${hasElev ? `<text x="${W / 2}" y="1240" font-family="Arial, sans-serif" font-size="30" fill="#A8FF3E" text-anchor="middle">↑ ${Math.round(d.elevationGainM!)} m de elevação</text>` : ''}
  <text x="${W / 2}" y="1310" font-family="Arial, sans-serif" font-size="26" fill="#ffffff" fill-opacity="0.4" text-anchor="middle" letter-spacing="3">CORRA · CONQUISTE · EVOLUA</text>
</svg>`;
}
