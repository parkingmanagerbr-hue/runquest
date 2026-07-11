import { describe, it, expect } from 'vitest';
import { routeToPath, buildRunCardSvg } from '../runCard';

const coords = [[-46.63, -23.55], [-46.62, -23.55], [-46.62, -23.56], [-46.63, -23.56], [-46.63, -23.55]];
const W = 1080, H = 760, PAD = 120;

describe('routeToPath', () => {
  it('projeta N pontos dentro do padding, sem NaN', () => {
    const p = routeToPath(coords, W, H, PAD);
    expect(p.startsWith('M')).toBe(true);
    const nums = [...p.matchAll(/([ML])([-\d.]+),([-\d.]+)/g)];
    expect(nums.length).toBe(coords.length);
    for (const m of nums) {
      const x = +m[2], y = +m[3];
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(PAD - 1);
      expect(x).toBeLessThanOrEqual(W - PAD + 1);
      expect(y).toBeGreaterThanOrEqual(PAD - 1);
      expect(y).toBeLessThanOrEqual(H - PAD + 1);
    }
  });

  it('preserva a forma: rota larga → span X > span Y', () => {
    const wide = [[-46.70, -23.55], [-46.60, -23.55], [-46.65, -23.552]];
    const nw = [...routeToPath(wide, W, H, PAD).matchAll(/([-\d.]+),([-\d.]+)/g)].map((m) => [+m[1], +m[2]]);
    const xs = nw.map((a) => a[0]), ys = nw.map((a) => a[1]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(Math.max(...ys) - Math.min(...ys));
  });

  it('edges: vazio/1 ponto → string vazia', () => {
    expect(routeToPath([], W, H, PAD)).toBe('');
    expect(routeToPath([[-46.6, -23.5]], W, H, PAD)).toBe('');
  });

  it('pontos idênticos e coordenadas sujas → sem NaN', () => {
    expect(routeToPath([[-46.6, -23.5], [-46.6, -23.5], [-46.6, -23.5]], W, H, PAD)).not.toMatch(/NaN/);
    expect(routeToPath([[NaN, 1], [-46.6, -23.5], [-46.61, -23.51]], W, H, PAD)).not.toMatch(/NaN/);
  });
});

describe('buildRunCardSvg', () => {
  it('SVG bem formado com distância, marca e tempo', () => {
    const svg = buildRunCardSvg({
      coordinates: coords, distanceMeters: 5230, durationSec: 1620,
      avgPaceSecPerKm: 310, dateLabel: '04 jul 2026', elevationGainM: 42, title: 'Corrida matinal',
    });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('</svg>');
    expect(svg).toContain('5.23');
    expect(svg).toContain('RunQuest');
    expect(svg).toContain('27:00');
  });

  it('escapa caracteres especiais no título; sem rota → placeholder', () => {
    const svg = buildRunCardSvg({
      coordinates: [], distanceMeters: 1000, durationSec: 300, avgPaceSecPerKm: 300, dateLabel: 'x', title: 'A<b>&"',
    });
    expect(svg).toContain('A&lt;b&gt;&amp;&quot;');
    expect(svg).toContain('sem traçado GPS');
  });
});
